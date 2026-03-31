import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  applyLocalSetupWorkspaceConfig,
  ONBOARDING_DEFAULT_HIZAL_AUTH_HEADER,
  ONBOARDING_DEFAULT_DM_SCOPE,
  ONBOARDING_DEFAULT_HIZAL_TRANSPORT,
  ONBOARDING_DEFAULT_HIZAL_MCP_URL,
  ONBOARDING_DEFAULT_TOOLS_PROFILE,
} from "./onboard-config.js";

describe("applyLocalSetupWorkspaceConfig", () => {
  it("defaults local setup tool profile to coding", () => {
    expect(ONBOARDING_DEFAULT_TOOLS_PROFILE).toBe("coding");
  });

  it("sets secure dmScope default when unset", () => {
    const baseConfig: OpenClawConfig = {};
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe(ONBOARDING_DEFAULT_DM_SCOPE);
    expect(result.gateway?.mode).toBe("local");
    expect(result.agents?.defaults?.workspace).toBe("/tmp/workspace");
    expect(result.agents?.defaults?.hizal).toEqual({
      enabled: true,
      lifecycleSlug: "orchestrator",
      projectId: undefined,
      serverName: "hizal",
    });
    expect(result.tools?.profile).toBe(ONBOARDING_DEFAULT_TOOLS_PROFILE);
    expect(result.memory?.backend).toBe("hizal");
    expect(result.mcp?.servers?.hizal?.transport).toBe(ONBOARDING_DEFAULT_HIZAL_TRANSPORT);
    expect(result.mcp?.servers?.hizal?.url).toBe(ONBOARDING_DEFAULT_HIZAL_MCP_URL);
    expect(result.mcp?.servers?.hizal?.headers).toEqual({
      Authorization: ONBOARDING_DEFAULT_HIZAL_AUTH_HEADER,
    });
  });

  it("preserves existing dmScope when already configured", () => {
    const baseConfig: OpenClawConfig = {
      session: {
        dmScope: "main",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("main");
  });

  it("preserves explicit non-main dmScope values", () => {
    const baseConfig: OpenClawConfig = {
      session: {
        dmScope: "per-account-channel-peer",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("per-account-channel-peer");
  });

  it("preserves an explicit tools.profile when already configured", () => {
    const baseConfig: OpenClawConfig = {
      tools: {
        profile: "full",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.tools?.profile).toBe("full");
  });

  it("preserves explicit Hizal MCP and agent settings when already configured", () => {
    const baseConfig: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: {
            enabled: false,
            lifecycleSlug: "dev",
            projectId: "proj-123",
            serverName: "remote-hizal",
          },
        },
      },
      memory: {
        backend: "builtin",
      },
      mcp: {
        servers: {
          hizal: {
            url: "https://example.com/custom-mcp",
            headers: {
              Authorization: "Bearer token",
            },
          },
        },
      },
    };

    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.agents?.defaults?.hizal).toEqual({
      enabled: false,
      lifecycleSlug: "dev",
      projectId: "proj-123",
      serverName: "remote-hizal",
    });
    expect(result.memory?.backend).toBe("builtin");
    expect(result.mcp?.servers?.hizal).toEqual({
      transport: "streamable-http",
      url: "https://example.com/custom-mcp",
      headers: {
        Authorization: "Bearer token",
      },
    });
  });
});
