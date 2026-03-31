import {
  callHizalTool,
  resolveAgentHizalConfig,
  resolveAgentWorkspaceDir,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/memory-core-host-engine-foundation";
import type {
  MemoryEmbeddingProbeResult,
  MemoryProviderStatus,
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";

type HizalSearchContextResult = {
  results?: Array<{
    id?: string;
    query_key?: string;
    title?: string;
    content?: string;
    score?: number;
    source_file?: string;
  }>;
};

type HizalReadContextResult = {
  id?: string;
  query_key?: string;
  title?: string;
  content?: string;
};

function buildOpenClawSessionId(agentId: string, sessionKey?: string): string {
  return sessionKey?.trim() || `memory-hizal:${agentId}`;
}

function buildMemoryPath(entry: { id?: string; query_key?: string }): string {
  if (entry.id?.trim()) {
    return `hizal:id:${entry.id.trim()}`;
  }
  if (entry.query_key?.trim()) {
    return `hizal:query_key:${entry.query_key.trim()}`;
  }
  throw new Error("Hizal search result is missing both id and query_key");
}

function parseMemoryPath(relPath: string): { id?: string; queryKey?: string } {
  if (relPath.startsWith("hizal:id:")) {
    return { id: relPath.slice("hizal:id:".length).trim() || undefined };
  }
  if (relPath.startsWith("hizal:query_key:")) {
    return { queryKey: relPath.slice("hizal:query_key:".length).trim() || undefined };
  }
  return { queryKey: relPath.trim() || undefined };
}

function sliceByLines(content: string, from?: number, lines?: number): string {
  const allLines = content.split(/\r?\n/);
  const startIndex = Math.max((from ?? 1) - 1, 0);
  const endIndex = typeof lines === "number" && lines > 0 ? startIndex + lines : undefined;
  return allLines.slice(startIndex, endIndex).join("\n");
}

export class HizalMemorySearchManager implements MemorySearchManager {
  static create(params: { cfg: OpenClawConfig; agentId: string }): HizalMemorySearchManager {
    return new HizalMemorySearchManager(params);
  }

  constructor(
    private readonly params: {
      cfg: OpenClawConfig;
      agentId: string;
    },
  ) {}

  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]> {
    const hizal = resolveAgentHizalConfig(this.params.cfg, this.params.agentId);
    const workspaceDir = resolveAgentWorkspaceDir(this.params.cfg, this.params.agentId);
    const result = await callHizalTool<HizalSearchContextResult>({
      openclawSessionId: buildOpenClawSessionId(this.params.agentId, opts?.sessionKey),
      sessionKey: opts?.sessionKey,
      workspaceDir,
      cfg: this.params.cfg,
      serverName: hizal?.serverName,
      toolName: "search_context",
      input: {
        query,
        scope: "AGENT",
        chunk_type: "MEMORY",
        ...(typeof opts?.maxResults === "number" ? { limit: opts.maxResults } : {}),
      },
    });
    return (result.results ?? [])
      .filter((entry) => typeof entry.content === "string" && entry.content.trim().length > 0)
      .map((entry) => {
        const snippet = entry.content?.trim() ?? "";
        return {
          path: buildMemoryPath(entry),
          startLine: 1,
          endLine: snippet.split(/\r?\n/).length,
          score: typeof entry.score === "number" ? entry.score : 0,
          snippet,
          source: "memory" as const,
          citation: entry.source_file,
        };
      })
      .filter((entry) => (opts?.minScore ?? 0) <= entry.score);
  }

  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const hizal = resolveAgentHizalConfig(this.params.cfg, this.params.agentId);
    const workspaceDir = resolveAgentWorkspaceDir(this.params.cfg, this.params.agentId);
    const ref = parseMemoryPath(params.relPath);
    const result = await callHizalTool<HizalReadContextResult>({
      openclawSessionId: buildOpenClawSessionId(this.params.agentId),
      workspaceDir,
      cfg: this.params.cfg,
      serverName: hizal?.serverName,
      toolName: "read_context",
      input: ref.id ? { id: ref.id } : { query_key: ref.queryKey },
    });
    const content = typeof result.content === "string" ? result.content : "";
    return {
      path: params.relPath,
      text: sliceByLines(content, params.from, params.lines),
    };
  }

  status(): MemoryProviderStatus {
    return {
      backend: "hizal",
      provider: "hizal",
      workspaceDir: resolveAgentWorkspaceDir(this.params.cfg, this.params.agentId),
      custom: {
        scope: "AGENT",
        chunkType: "MEMORY",
      },
    };
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    return { ok: true };
  }

  async probeVectorAvailability(): Promise<boolean> {
    return true;
  }
}
