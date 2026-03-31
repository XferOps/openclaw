import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { makeTempWorkspace } from "../test-helpers/workspace.js";
import { DEFAULT_ASSISTANT_IDENTITY, resolveAssistantIdentity } from "./assistant-identity.js";

describe("resolveAssistantIdentity avatar normalization", () => {
  it("drops sentence-like avatar placeholders", () => {
    const cfg: OpenClawConfig = {
      ui: {
        assistant: {
          avatar: "workspace-relative path, http(s) URL, or data URI",
        },
      },
    };

    expect(resolveAssistantIdentity({ cfg, workspaceDir: "" }).avatar).toBe(
      DEFAULT_ASSISTANT_IDENTITY.avatar,
    );
  });

  it("keeps short text avatars", () => {
    const cfg: OpenClawConfig = {
      ui: {
        assistant: {
          avatar: "PS",
        },
      },
    };

    expect(resolveAssistantIdentity({ cfg, workspaceDir: "" }).avatar).toBe("PS");
  });

  it("keeps path avatars", () => {
    const cfg: OpenClawConfig = {
      ui: {
        assistant: {
          avatar: "avatars/openclaw.png",
        },
      },
    };

    expect(resolveAssistantIdentity({ cfg, workspaceDir: "" }).avatar).toBe("avatars/openclaw.png");
  });

  it("prefers Hizal identity snapshot when enabled", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-identity-");
    await fs.mkdir(path.join(workspaceDir, ".openclaw", "hizal"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, ".openclaw", "hizal", "identity-snapshot.json"),
      JSON.stringify({
        chunkId: "identity-1",
        queryKey: "agent-identity",
        title: "Hizal Agent",
        content: "I am Hizal Agent.",
        markdown: "# Hizal Identity\n\nI am Hizal Agent.\n",
        name: "Hizal Agent",
        updatedAt: new Date().toISOString(),
      }),
      "utf-8",
    );
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          hizal: { enabled: true },
        },
        list: [{ id: "main" }],
      },
      ui: {
        assistant: {
          name: "Local Assistant",
        },
      },
    };

    expect(resolveAssistantIdentity({ cfg, workspaceDir, agentId: "main" }).name).toBe(
      "Hizal Agent",
    );
    expect(resolveAssistantIdentity({ cfg, workspaceDir, agentId: "main" }).avatar).toBe(
      DEFAULT_ASSISTANT_IDENTITY.avatar,
    );
  });
});
