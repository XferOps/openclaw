import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentHizalConfig } from "./agent-scope.js";
import { callHizalTool } from "./hizal-mcp.js";
import {
  clearHizalIdentitySnapshot,
  clearHizalSessionState,
  readHizalSessionState,
  writeHizalSessionState,
} from "./hizal-state.js";

export type HizalInjectedChunk = {
  id: string;
  query_key: string;
  title: string;
  content: string;
  scope: string;
  chunk_type: string;
};

type HizalGetActiveSessionResult = {
  session_id?: string;
  status: "active" | "none";
  lifecycle_slug?: string;
  focus_task?: string;
  expires_at?: string;
  chunks_written?: number;
  resume_count?: number;
  inject_set?: string[];
  message?: string;
};

type HizalStartSessionResult = {
  session_id: string;
  expires_at: string;
  lifecycle: string;
  required_steps?: string[];
  injected_chunks: HizalInjectedChunk[];
};

type HizalResumeSessionResult = {
  session_id: string;
  expires_at: string;
  focus_task?: string;
  chunks_written?: number;
  resume_count?: number;
  injected_chunks: HizalInjectedChunk[];
};

export type EnsureHizalSessionResult = {
  sessionId: string;
  lifecycleSlug: string;
  projectId?: string;
  source: "started" | "resumed";
  injectedChunks: HizalInjectedChunk[];
  requiredSteps?: string[];
  focusTask?: string;
};

function resolveHizalRuntimeConfig(cfg: OpenClawConfig | undefined, agentId: string | undefined) {
  const config = cfg && agentId ? resolveAgentHizalConfig(cfg, agentId) : undefined;
  if (!config?.enabled) {
    return null;
  }
  return {
    lifecycleSlug: config.lifecycleSlug?.trim() || "orchestrator",
    projectId: config.projectId?.trim() || undefined,
    serverName: config.serverName?.trim() || "hizal",
  };
}

export async function ensureHizalSession(params: {
  openclawSessionId: string;
  sessionKey?: string;
  workspaceDir: string;
  cfg?: OpenClawConfig;
  agentId?: string;
}): Promise<EnsureHizalSessionResult | null> {
  const runtimeConfig = resolveHizalRuntimeConfig(params.cfg, params.agentId);
  if (!runtimeConfig) {
    return null;
  }

  const existing = await readHizalSessionState(params.workspaceDir);
  const active = await callHizalTool<HizalGetActiveSessionResult>({
    openclawSessionId: params.openclawSessionId,
    sessionKey: params.sessionKey,
    workspaceDir: params.workspaceDir,
    cfg: params.cfg,
    serverName: runtimeConfig.serverName,
    toolName: "get_active_session",
  });

  const shouldRotateForNewOpenClawSession =
    active.status === "active" &&
    Boolean(active.session_id) &&
    (existing.openclawSessionId == null || existing.openclawSessionId !== params.openclawSessionId);

  if (shouldRotateForNewOpenClawSession && active.session_id) {
    await callHizalTool({
      openclawSessionId: params.openclawSessionId,
      sessionKey: params.sessionKey,
      workspaceDir: params.workspaceDir,
      cfg: params.cfg,
      serverName: runtimeConfig.serverName,
      toolName: "end_session",
      input: { session_id: active.session_id },
    }).catch(() => {});
  }

  if (
    active.status === "active" &&
    active.session_id &&
    !shouldRotateForNewOpenClawSession &&
    existing.openclawSessionId === params.openclawSessionId
  ) {
    const resumed = await callHizalTool<HizalResumeSessionResult>({
      openclawSessionId: params.openclawSessionId,
      sessionKey: params.sessionKey,
      workspaceDir: params.workspaceDir,
      cfg: params.cfg,
      serverName: runtimeConfig.serverName,
      toolName: "resume_session",
      input: { session_id: active.session_id },
    });
    await writeHizalSessionState(params.workspaceDir, {
      openclawSessionId: params.openclawSessionId,
      sessionId: resumed.session_id,
      lifecycleSlug: active.lifecycle_slug ?? existing.lifecycleSlug ?? runtimeConfig.lifecycleSlug,
      projectId: existing.projectId ?? runtimeConfig.projectId,
      lastStartedAt: existing.lastStartedAt,
      lastResumedAt: new Date().toISOString(),
    });
    return {
      sessionId: resumed.session_id,
      lifecycleSlug: active.lifecycle_slug ?? existing.lifecycleSlug ?? runtimeConfig.lifecycleSlug,
      projectId: existing.projectId ?? runtimeConfig.projectId,
      source: "resumed",
      injectedChunks: resumed.injected_chunks,
      focusTask: resumed.focus_task,
    };
  }

  const started = await callHizalTool<HizalStartSessionResult>({
    openclawSessionId: params.openclawSessionId,
    sessionKey: params.sessionKey,
    workspaceDir: params.workspaceDir,
    cfg: params.cfg,
    serverName: runtimeConfig.serverName,
    toolName: "start_session",
    input: {
      lifecycle_slug: runtimeConfig.lifecycleSlug,
      ...(runtimeConfig.projectId ? { project_id: runtimeConfig.projectId } : {}),
    },
  });
  const now = new Date().toISOString();
  await writeHizalSessionState(params.workspaceDir, {
    openclawSessionId: params.openclawSessionId,
    sessionId: started.session_id,
    lifecycleSlug: started.lifecycle,
    projectId: runtimeConfig.projectId,
    lastStartedAt: now,
    lastResumedAt: now,
  });
  return {
    sessionId: started.session_id,
    lifecycleSlug: started.lifecycle,
    projectId: runtimeConfig.projectId,
    source: "started",
    injectedChunks: started.injected_chunks,
    requiredSteps: started.required_steps,
  };
}

export async function endHizalSession(params: {
  openclawSessionId: string;
  sessionKey?: string;
  workspaceDir: string;
  cfg?: OpenClawConfig;
  agentId?: string;
}): Promise<void> {
  const runtimeConfig = resolveHizalRuntimeConfig(params.cfg, params.agentId);
  if (!runtimeConfig) {
    return;
  }
  const existing = await readHizalSessionState(params.workspaceDir);
  if (!existing.sessionId) {
    return;
  }
  try {
    await callHizalTool({
      openclawSessionId: params.openclawSessionId,
      sessionKey: params.sessionKey,
      workspaceDir: params.workspaceDir,
      cfg: params.cfg,
      serverName: runtimeConfig.serverName,
      toolName: "end_session",
      input: { session_id: existing.sessionId },
    });
  } finally {
    await clearHizalSessionState(params.workspaceDir);
    await clearHizalIdentitySnapshot(params.workspaceDir);
  }
}
