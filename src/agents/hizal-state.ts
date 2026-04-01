import fs from "node:fs";
import path from "node:path";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "../plugin-sdk/json-store.js";
import { safeParseJson } from "../utils.js";

export type HizalSessionState = {
  openclawSessionId?: string;
  sessionId?: string;
  lifecycleSlug?: string;
  projectId?: string;
  lastStartedAt?: string;
  lastResumedAt?: string;
};

export type HizalIdentitySnapshot = {
  chunkId: string;
  queryKey: string;
  title: string;
  content: string;
  markdown: string;
  name?: string;
  emoji?: string;
  avatar?: string;
  updatedAt: string;
};

function resolveHizalStateDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openclaw", "hizal");
}

export function resolveHizalSessionStatePath(workspaceDir: string): string {
  return path.join(resolveHizalStateDir(workspaceDir), "session-state.json");
}

export function resolveHizalIdentitySnapshotPath(workspaceDir: string): string {
  return path.join(resolveHizalStateDir(workspaceDir), "identity-snapshot.json");
}

export async function readHizalSessionState(workspaceDir: string): Promise<HizalSessionState> {
  const result = await readJsonFileWithFallback<HizalSessionState>(
    resolveHizalSessionStatePath(workspaceDir),
    {},
  );
  return result.value;
}

export async function writeHizalSessionState(
  workspaceDir: string,
  state: HizalSessionState,
): Promise<void> {
  await writeJsonFileAtomically(resolveHizalSessionStatePath(workspaceDir), state);
}

export async function clearHizalSessionState(workspaceDir: string): Promise<void> {
  await fs.promises.rm(resolveHizalSessionStatePath(workspaceDir), { force: true }).catch(() => {});
}

export async function writeHizalIdentitySnapshot(
  workspaceDir: string,
  snapshot: HizalIdentitySnapshot,
): Promise<void> {
  await writeJsonFileAtomically(resolveHizalIdentitySnapshotPath(workspaceDir), snapshot);
}

export async function clearHizalIdentitySnapshot(workspaceDir: string): Promise<void> {
  await fs.promises
    .rm(resolveHizalIdentitySnapshotPath(workspaceDir), { force: true })
    .catch(() => {});
}

export function readHizalIdentitySnapshotSync(workspaceDir: string): HizalIdentitySnapshot | null {
  try {
    const raw = fs.readFileSync(resolveHizalIdentitySnapshotPath(workspaceDir), "utf-8");
    return safeParseJson<HizalIdentitySnapshot>(raw);
  } catch {
    return null;
  }
}
