import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { OpenClawConfig } from "../config/config.js";
import { disposeSessionMcpRuntime, getOrCreateSessionMcpRuntime } from "./pi-bundle-mcp-tools.js";

type JsonRecord = Record<string, unknown>;

export type HizalMcpBaseParams = {
  openclawSessionId: string;
  sessionKey?: string;
  workspaceDir: string;
  cfg?: OpenClawConfig;
  serverName?: string;
};

export type CallHizalToolParams = HizalMcpBaseParams & {
  toolName: string;
  input?: JsonRecord;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractToolErrorMessage(result: CallToolResult, toolName: string): string {
  if (isJsonRecord(result.structuredContent)) {
    const message = result.structuredContent.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    const error = result.structuredContent.error;
    if (isJsonRecord(error) && typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
  }
  for (const block of result.content ?? []) {
    if (block.type !== "text") {
      continue;
    }
    if (typeof block.text === "string" && block.text.trim()) {
      return block.text;
    }
  }
  return `MCP tool ${toolName} failed`;
}

function extractStructuredContent<T>(result: CallToolResult, toolName: string): T {
  if (result.isError) {
    throw new Error(extractToolErrorMessage(result, toolName));
  }
  if (result.structuredContent !== undefined) {
    return result.structuredContent as T;
  }
  for (const block of result.content ?? []) {
    if (block.type !== "text") {
      continue;
    }
    if (!block.text.trim()) {
      continue;
    }
    try {
      return JSON.parse(block.text) as T;
    } catch {
      // Fall through to the generic error below.
    }
  }
  throw new Error(`MCP tool ${toolName} did not return structured content`);
}

async function getHizalRuntime(params: HizalMcpBaseParams) {
  return await getOrCreateSessionMcpRuntime({
    sessionId: params.openclawSessionId,
    sessionKey: params.sessionKey,
    workspaceDir: params.workspaceDir,
    cfg: params.cfg,
  });
}

export async function assertHizalServerAvailable(
  params: HizalMcpBaseParams,
): Promise<{ runtime: Awaited<ReturnType<typeof getHizalRuntime>>; serverName: string }> {
  const expectedServerName = params.serverName?.trim() || "hizal";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const runtime = await getHizalRuntime(params);
    const catalog = await runtime.getCatalog();
    const matched = catalog.tools.find((tool) => tool.serverName === expectedServerName);
    if (matched) {
      return { runtime, serverName: matched.serverName };
    }
    if (attempt === 0) {
      await disposeSessionMcpRuntime(params.openclawSessionId).catch(() => {});
      continue;
    }
  }
  throw new Error(`Hizal MCP server "${expectedServerName}" is not configured or has no tools`);
}

export async function callHizalTool<T>(params: CallHizalToolParams): Promise<T> {
  const { runtime, serverName } = await assertHizalServerAvailable(params);
  const result = await runtime.callTool(serverName, params.toolName, params.input ?? {});
  return extractStructuredContent<T>(result, params.toolName);
}
