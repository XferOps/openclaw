import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrCreateSessionMcpRuntime = vi.hoisted(() => vi.fn());
const disposeSessionMcpRuntime = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./pi-bundle-mcp-tools.js", () => ({
  getOrCreateSessionMcpRuntime,
  disposeSessionMcpRuntime,
}));

describe("assertHizalServerAvailable", () => {
  beforeEach(() => {
    getOrCreateSessionMcpRuntime.mockReset();
    disposeSessionMcpRuntime.mockReset();
  });

  it("retries once after an empty catalog", async () => {
    const firstRuntime = {
      getCatalog: vi.fn(async () => ({ tools: [] })),
    };
    const secondRuntime = {
      getCatalog: vi.fn(async () => ({
        tools: [{ serverName: "hizal", toolName: "start_session" }],
      })),
    };
    getOrCreateSessionMcpRuntime
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime);

    const { assertHizalServerAvailable } = await import("./hizal-mcp.js");
    const result = await assertHizalServerAvailable({
      openclawSessionId: "session-1",
      workspaceDir: "/tmp/workspace",
    });

    expect(disposeSessionMcpRuntime).toHaveBeenCalledWith("session-1");
    expect(result.serverName).toBe("hizal");
    expect(result.runtime).toBe(secondRuntime);
  });
});
