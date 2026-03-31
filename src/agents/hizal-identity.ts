import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { ensureHizalSession, type HizalInjectedChunk } from "./hizal-session.js";
import { type HizalIdentitySnapshot, writeHizalIdentitySnapshot } from "./hizal-state.js";

export type HizalResolvedIdentity = HizalIdentitySnapshot;

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

export function resolveIdentityChunk(chunks: HizalInjectedChunk[]): HizalInjectedChunk {
  const match = chunks.find((chunk) => chunk.chunk_type === "IDENTITY");
  if (!match) {
    throw new Error("Hizal session did not return an injected IDENTITY chunk");
  }
  return match;
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
