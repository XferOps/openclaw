import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HizalInjectedChunk } from "./hizal-session.js";

const ensureHizalSession = vi.hoisted(() => vi.fn());

vi.mock("./hizal-session.js", async () => {
  const actual = await vi.importActual<typeof import("./hizal-session.js")>("./hizal-session.js");
  return {
    ...actual,
    ensureHizalSession,
  };
});

import { resolveHizalIdentity, resolveIdentityChunk } from "./hizal-identity.js";

function makeIdentityChunk(): HizalInjectedChunk {
  return {
    id: "identity-1",
    query_key: "agent-identity",
    title: "Main Agent",
    content: "I am Main.",
    scope: "AGENT",
    chunk_type: "IDENTITY",
  };
}

describe("resolveIdentityChunk", () => {
  it("returns the IDENTITY chunk when present", () => {
    const chunk = makeIdentityChunk();
    expect(resolveIdentityChunk([chunk])).toBe(chunk);
  });

  it("returns undefined when chunks are undefined", () => {
    expect(resolveIdentityChunk(undefined)).toBeUndefined();
  });

  it("returns undefined when no IDENTITY chunk exists", () => {
    expect(resolveIdentityChunk([])).toBeUndefined();
  });
});

describe("resolveHizalIdentity", () => {
  beforeEach(() => {
    ensureHizalSession.mockReset();
  });

  it("skips the overlay when the session omits injected chunks", async () => {
    ensureHizalSession.mockResolvedValue({
      sessionId: "sess-1",
      lifecycleSlug: "admin",
      source: "resumed",
      injectedChunks: [],
    });

    await expect(
      resolveHizalIdentity({
        openclawSessionId: "openclaw-session-1",
        workspaceDir: "/tmp/openclaw-hizal-identity",
        agentId: "main",
      }),
    ).resolves.toBeNull();
  });
});
