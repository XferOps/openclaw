import type { OpenClawConfig } from "../config/config.js";
import type { DmScope } from "../config/types.base.js";
import type { ToolProfileId } from "../config/types.tools.js";

export const ONBOARDING_DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";
export const ONBOARDING_DEFAULT_TOOLS_PROFILE: ToolProfileId = "coding";
export const ONBOARDING_DEFAULT_HIZAL_MCP_URL = "https://api.hizal.ai/mcp";
export const ONBOARDING_DEFAULT_HIZAL_AUTH_HEADER = "Bearer ${HIZAL_API_KEY}";
export const ONBOARDING_DEFAULT_HIZAL_TRANSPORT = "streamable-http";

export function applyLocalSetupWorkspaceConfig(
  baseConfig: OpenClawConfig,
  workspaceDir: string,
): OpenClawConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
        hizal: {
          enabled: baseConfig.agents?.defaults?.hizal?.enabled ?? true,
          lifecycleSlug: baseConfig.agents?.defaults?.hizal?.lifecycleSlug ?? "orchestrator",
          projectId: baseConfig.agents?.defaults?.hizal?.projectId,
          serverName: baseConfig.agents?.defaults?.hizal?.serverName ?? "hizal",
        },
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
    session: {
      ...baseConfig.session,
      dmScope: baseConfig.session?.dmScope ?? ONBOARDING_DEFAULT_DM_SCOPE,
    },
    tools: {
      ...baseConfig.tools,
      profile: baseConfig.tools?.profile ?? ONBOARDING_DEFAULT_TOOLS_PROFILE,
    },
    memory: {
      ...baseConfig.memory,
      backend: baseConfig.memory?.backend ?? "hizal",
    },
    mcp: {
      ...baseConfig.mcp,
      servers: {
        ...baseConfig.mcp?.servers,
        hizal: {
          ...baseConfig.mcp?.servers?.hizal,
          transport:
            baseConfig.mcp?.servers?.hizal?.transport ?? ONBOARDING_DEFAULT_HIZAL_TRANSPORT,
          url: baseConfig.mcp?.servers?.hizal?.url ?? ONBOARDING_DEFAULT_HIZAL_MCP_URL,
          headers: {
            Authorization:
              baseConfig.mcp?.servers?.hizal?.headers?.Authorization ??
              ONBOARDING_DEFAULT_HIZAL_AUTH_HEADER,
            ...baseConfig.mcp?.servers?.hizal?.headers,
          },
        },
      },
    },
  };
}
