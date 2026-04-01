import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { makeTempWorkspace } from "../test-helpers/workspace.js";

const callHizalTool = vi.hoisted(() => vi.fn());

vi.mock("./hizal-mcp.js", () => ({
  callHizalTool,
}));

async function loadHizalSessionModule() {
  return await import("./hizal-session.js");
}

describe("ensureHizalSession", () => {
  beforeEach(() => {
    callHizalTool.mockReset();
  });

  it("starts a new Hizal session when none is active", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-hizal-session-");
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: {
            enabled: true,
            lifecycleSlug: "orchestrator",
            projectId: "proj-1",
          },
        },
        list: [{ id: "main" }],
      },
    };
    callHizalTool.mockResolvedValueOnce({ status: "none" }).mockResolvedValueOnce({
      session_id: "sess-1",
      lifecycle: "orchestrator",
      required_steps: [],
      injected_chunks: [
        {
          id: "identity-1",
          query_key: "agent-identity",
          title: "Main Agent",
          content: "I am Main.",
          scope: "AGENT",
          chunk_type: "IDENTITY",
        },
      ],
    });

    const { ensureHizalSession } = await loadHizalSessionModule();
    const result = await ensureHizalSession({
      openclawSessionId: "openclaw-session-1",
      sessionKey: "agent:main:direct:test",
      workspaceDir,
      cfg,
      agentId: "main",
    });

    expect(result).toMatchObject({
      sessionId: "sess-1",
      lifecycleSlug: "orchestrator",
      source: "started",
    });
    const raw = await fs.readFile(
      path.join(workspaceDir, ".openclaw", "hizal", "session-state.json"),
      "utf-8",
    );
    expect(raw).toContain("sess-1");
    expect(raw).toContain("openclaw-session-1");
  });

  it("resumes an active Hizal session", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-hizal-session-");
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: {
            enabled: true,
            lifecycleSlug: "orchestrator",
          },
        },
        list: [{ id: "main" }],
      },
    };
    await fs.mkdir(path.join(workspaceDir, ".openclaw", "hizal"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, ".openclaw", "hizal", "session-state.json"),
      JSON.stringify({ openclawSessionId: "openclaw-session-2", sessionId: "sess-existing" }),
      "utf-8",
    );
    callHizalTool
      .mockResolvedValueOnce({
        status: "active",
        session_id: "sess-existing",
        lifecycle_slug: "orchestrator",
      })
      .mockResolvedValueOnce({
        session_id: "sess-existing",
        injected_chunks: [
          {
            id: "identity-2",
            query_key: "agent-identity",
            title: "Main Agent",
            content: "I am Main.",
            scope: "AGENT",
            chunk_type: "IDENTITY",
          },
        ],
      });

    const { ensureHizalSession } = await loadHizalSessionModule();
    const result = await ensureHizalSession({
      openclawSessionId: "openclaw-session-2",
      sessionKey: "agent:main:direct:test",
      workspaceDir,
      cfg,
      agentId: "main",
    });

    expect(result).toMatchObject({
      sessionId: "sess-existing",
      source: "resumed",
    });
    expect(callHizalTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toolName: "resume_session",
        input: { session_id: "sess-existing" },
      }),
    );
  });

  it("ends an existing Hizal session when the OpenClaw session id changes", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-hizal-session-");
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: {
            enabled: true,
            lifecycleSlug: "orchestrator",
          },
        },
        list: [{ id: "main" }],
      },
    };
    await fs.mkdir(path.join(workspaceDir, ".openclaw", "hizal"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, ".openclaw", "hizal", "session-state.json"),
      JSON.stringify({ openclawSessionId: "openclaw-old", sessionId: "sess-old" }),
      "utf-8",
    );
    callHizalTool
      .mockResolvedValueOnce({
        status: "active",
        session_id: "sess-old",
        lifecycle_slug: "orchestrator",
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        session_id: "sess-new",
        lifecycle: "orchestrator",
        required_steps: [],
        injected_chunks: [
          {
            id: "identity-3",
            query_key: "agent-identity",
            title: "Main Agent",
            content: "I am Main.",
            scope: "AGENT",
            chunk_type: "IDENTITY",
          },
        ],
      });

    const { ensureHizalSession } = await loadHizalSessionModule();
    const result = await ensureHizalSession({
      openclawSessionId: "openclaw-new",
      sessionKey: "agent:main:direct:test",
      workspaceDir,
      cfg,
      agentId: "main",
    });

    expect(result).toMatchObject({
      sessionId: "sess-new",
      source: "started",
    });
    expect(callHizalTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toolName: "end_session",
        input: { session_id: "sess-old" },
      }),
    );
    expect(callHizalTool).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        toolName: "start_session",
      }),
    );
  });

  it("ends the persisted Hizal session and clears local state", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-hizal-session-");
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: {
            enabled: true,
          },
        },
        list: [{ id: "main" }],
      },
    };
    await fs.mkdir(path.join(workspaceDir, ".openclaw", "hizal"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, ".openclaw", "hizal", "session-state.json"),
      JSON.stringify({ sessionId: "sess-end" }),
      "utf-8",
    );
    callHizalTool.mockResolvedValueOnce({ session_id: "sess-end" });

    const { endHizalSession } = await loadHizalSessionModule();
    await endHizalSession({
      openclawSessionId: "openclaw-session-end",
      workspaceDir,
      cfg,
      agentId: "main",
    });

    expect(callHizalTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "end_session",
        input: { session_id: "sess-end" },
      }),
    );
    await expect(
      fs.access(path.join(workspaceDir, ".openclaw", "hizal", "session-state.json")),
    ).rejects.toThrow();
  });
});
