# Heartbeat re-arm can be permanently suppressed (retry loop + mute-without-clear)

> **READ THIS FIRST — capability, not (yet) occurrence.** This note documents the code path
> that **permits** the failure. **Whether this mechanism fired in the 19:48 outage is NOT
> confirmed.** The symptom (no tick) is produced by both a dropped handoff and a dead
> scheduler; the discriminators below are how to tell them apart. **Do not file this as "the
> cause" — file it as "the path, with the discriminator named."**

**Status:** open. **Found:** 2026-11-13/14 by david (symptom), peter + adam (source read).
**Scope:** `src/infra/heartbeat-runner.ts`, `src/infra/heartbeat-wake.ts`.
**Applies to:** the `XferOps/openclaw` fork we run. **Upstream home:** `openclaw/openclaw` —
filing there is a public claim about our hosts and is **gated on Parker's call**. This note is
the repo-local record until then.

## Symptom

Heartbeats stop ticking and never return; only a **process restart** restores them. Observed
2026-11-13: one host's heartbeats died ~19:48 and stayed dead for 6.5h until a manual restart.
The `openclaw status` heartbeat counter kept saying "30m" — the logs only print
`heartbeat: started` at boot and nothing per-tick, so the counter and the logs both look fine
while nothing is firing.

**Ground truth for "did it tick":** the session's `updatedAt` in
`~/.openclaw/agents/main/sessions/sessions.json` (`agent:main:main`), **not** the logs and
**not** `openclaw status` (they disagree — different clocks; see below).

## The code path

**`heartbeat-runner.ts`** — the runner has exactly one path that skips its own reschedule:

```js
if (res.status === "skipped" && res.reason === "requests-in-flight") {
  requestsInFlight = true;
  return res;              // <- returns; the finally-block re-arm is skipped
}
// ...
} finally {
  if (!requestsInFlight) {  // <- skipped precisely when requestsInFlight is true
    scheduleNext();
  }
}
```

So on a busy lane the runner **delegates re-arm to the wake layer**
(`heartbeat-wake.ts`, `DEFAULT_RETRY_MS = 1_000`).

**`heartbeat-wake.ts` → `schedule()`** — two things make that delegation unsafe:

```js
function schedule(coalesceMs, kind = "normal") {
  ...
  if (timer) {
    if (timerKind === "retry") { return; }   // (A) any schedule() is DROPPED while a retry timer is live
    ...
  }
  ...
  timer = setTimeout(async () => {
    ...
    if (running) {
      scheduled = true;
      schedule(delay, kind);                 // (B) the retry RE-ARMS ITSELF while still busy
      return;
    }
    ...
  }, delay);
  timer.unref?.();                           // (C) unref'd: does not hold the event loop
}
```

## The failure

1. A heartbeat run hits a busy lane → `requests-in-flight` → the runner **skips `scheduleNext()`**
   and relies on the wake layer.
2. The wake layer sets a `"retry"` timer.
3. If the lane is still busy when the retry fires, it **re-arms itself** (B) as another `"retry"`
   timer.
4. While `timerKind === "retry"`, **(A) mutes every other `schedule()`** — including the runner's
   normal re-arm and the wake layer's own `finally` reschedule.
5. So **one busy lane that never sees a free moment leaves the retry loop spinning, and the
   normal re-arm path stays muted — heartbeats never resume until a process restart.**

**It is a self-perpetuating loop, not a stuck single timer.** "Stuck timer" understates it and
would point at the wrong fix.

## How ordinary the trigger is (do not file this as exotic)

The trigger — `requests-in-flight` — is a **normal condition, not an edge case.** A busy main
lane is ordinary; a heartbeat landing while the lane is busy across a tick boundary is a
routine Tuesday. So this is **not** a bug that needs a rare coincidence: it fires whenever the
main lane is busy across a heartbeat tick. **That frequency is the reason it is worth fixing
rather than parkable.** If this note reads as "a rare race," the next reader deprioritizes it
and the loop wedges again on an ordinary busy moment.

## Two fixes are needed, not one

**This is the finding — do not collapse it to one fix.** The point fix alone does not cure the
loop; the loop's ceiling alone does not cure the muted re-arm. **Both.** If this note is read as
"fix the runner," the loop survives the patch.

- **Point fix (runner):** the runner should not leave its re-arm dependent on a delegated retry —
  it should own its reschedule regardless of `requests-in-flight` (e.g. re-arm with a delay,
  rather than skip).
- **Ceiling (wake layer):** the retry loop needs a bounded backoff / max-retry cap so a
  perpetually-busy lane cannot spin a `"retry"` timer forever, and so a retry can never mute
  the normal path indefinitely.

## Discriminators (how to tell which cause from the log)

- **The retry loop:** a **repeating** signature — same target, `retry` kind, ~1s cadence, never
  clearing. **Repetition is the tell.**
- **(A) suppressing (single instance):** one `retry` line, then silence.
- **The model-chain cascade (a different cause with the same symptom, no tick):** the heartbeat
  _did_ run but the model call failed — look for model-error lines, not retry lines.

## Caveat — capability, not (yet) occurrence

This note documents the code path that **permits** the failure. **Whether this mechanism fired in
the 19:48 outage is not confirmed.** The symptom (no tick) is produced by both a dropped handoff
and a dead scheduler; the discriminators above are how to tell them apart. Do not file this as
"the cause" — file it as "the path, with the discriminator named."

## Per-host note (the fix differs by host)

This bug was found while the **wake scripts themselves** were found to be under-versioned, and
the states differed per host: on one host `prototype/` was **staged but uncommitted** (one commit
fixes it); on another the scripts were **deleted but still running from held-open fds** (recover
from the fd or git history — reconstruct, don't commit). **If you are on the wrong host, you
will reconstruct instead of committing, or commit instead of reconstructing.** Check which host
you are on before acting. (The scripts are now versioned in `parkerscobey/campfire` under
`prototype/`.)

## Method note (why the note exists here and not a ticket)

`XferOps/openclaw` has **issues disabled** (`hasIssuesEnabled: false`); the upstream
`openclaw/openclaw` tracker is enabled but a public claim about our hosts. This `docs/debug/`
note sits beside the existing `node-issue.md` precedent — visible to anyone reading the runner,
without speaking for the project in public.
