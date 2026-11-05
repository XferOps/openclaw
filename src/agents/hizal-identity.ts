import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { ensureHizalSession, type HizalInjectedChunk } from "./hizal-session.js";
import { type HizalIdentitySnapshot, writeHizalIdentitySnapshot } from "./hizal-state.js";

export type HizalResolvedIdentity = HizalIdentitySnapshot;

let log: ReturnType<typeof createSubsystemLogger> | null = null;

function getLog(): ReturnType<typeof createSubsystemLogger> {
  log ??= createSubsystemLogger("hizal-identity");
  return log;
}

function deriveIdentityName(chunk: HizalInjectedChunk): string | undefined {
  const title = chunk.title.trim();
  if (!title) {
    return undefined;
  }
  const separatorIndex = title.indexOf(" - ");
  if (separatorIndex > 0) {
    return title.slice(0, separatorIndex).trim() || undefined;
  }
  const emDashIndex = title.indexOf(" -- ");
  if (emDashIndex > 0) {
    return title.slice(0, emDashIndex).trim() || undefined;
  }
  return title;
}

function buildIdentityMarkdownFromChunk(chunk: HizalInjectedChunk): string {
  return [`# Hizal Identity`, "", chunk.content.trim()].join("\n").trimEnd() + "\n";
}

export function resolveIdentityChunk(
  chunks: HizalInjectedChunk[] | undefined,
): HizalInjectedChunk | undefined {
  return chunks?.find((chunk) => chunk.chunk_type === "IDENTITY");
}

export async function resolveHizalIdentity(params: {
  openclawSessionId: string;
  sessionKey?: string;
  workspaceDir: string;
  cfg?: OpenClawConfig;
  agentId?: string;
}): Promise<HizalResolvedIdentity | null> {
  const session = await ensureHizalSession(params);
  if (!session) {
    return null;
  }
  const chunk = resolveIdentityChunk(session.injectedChunks);
  if (!chunk) {
    // Some Hizal session responses (notably resume_session) omit injected
    // chunks, and a session may legitimately have no IDENTITY chunk. Fall back
    // to the workspace identity files rather than failing the entire run.
    getLog().warn(
      "Hizal session returned no IDENTITY chunk; keeping local workspace identity files.",
    );
    return null;
  }
  const markdown = buildIdentityMarkdownFromChunk(chunk);
  const snapshot: HizalResolvedIdentity = {
    chunkId: chunk.id,
    queryKey: chunk.query_key,
    title: chunk.title,
    content: chunk.content,
    markdown,
    name: deriveIdentityName(chunk),
    updatedAt: new Date().toISOString(),
  };
  await writeHizalIdentitySnapshot(params.workspaceDir, snapshot);
  return snapshot;
}

export function createSyntheticIdentityBootstrapFile(params: {
  workspaceDir: string;
  content: string;
}) {
  return {
    name: "IDENTITY.md" as const,
    path: path.join(params.workspaceDir, ".openclaw", "hizal", "IDENTITY.md"),
    content: params.content,
    missing: false,
  };
}
