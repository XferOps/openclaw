# Install Your Fork Locally

Use this flow to install your OpenClaw fork as a normal global CLI without running it in dev mode.

## Build

```bash
cd openclaw
pnpm install
pnpm ui:build
pnpm build
```

## Pack

Create a tarball from the built package:

```bash
npm pack
```

This produces a file like:

```text
openclaw-2026.3.31.tgz
```

## Install Globally

Install the packed tarball globally:

```bash
npm i -g ./openclaw-*.tgz
```

## Verify

Check that the installed CLI runs normally:

```bash
openclaw --help
openclaw onboard
```

## Optional: Test In A Separate Profile

If you want to keep your existing setup isolated:

```bash
export HIZAL_API_KEY="your-real-key"
export OPENCLAW_PROFILE=hizal-dev
openclaw onboard
```

## Reinstall After Changes

When you change the fork again, rebuild, repack, and reinstall:

```bash
pnpm build
npm pack
npm i -g ./openclaw-*.tgz
```
