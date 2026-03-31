import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveAgentHizalConfig } from "../agents/agent-scope.js";
import { readHizalIdentitySnapshotSync } from "../agents/hizal-state.js";
import { resolveAgentIdentity } from "../agents/identity.js";
import { loadAgentIdentity } from "../commands/agents.config.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { coerceIdentityValue } from "../shared/assistant-identity-values.js";
import {
  isAvatarHttpUrl,
  isAvatarImageDataUrl,
  looksLikeAvatarPath,
} from "../shared/avatar-policy.js";

const MAX_ASSISTANT_NAME = 50;
const MAX_ASSISTANT_AVATAR = 200;
const MAX_ASSISTANT_EMOJI = 16;

export const DEFAULT_ASSISTANT_IDENTITY: AssistantIdentity = {
  agentId: "main",
  name: "Assistant",
  avatar: "A",
};

export type AssistantIdentity = {
  agentId: string;
  name: string;
  avatar: string;
  emoji?: string;
};

function isAvatarUrl(value: string): boolean {
  return isAvatarHttpUrl(value) || isAvatarImageDataUrl(value);
}

function normalizeAvatarValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isAvatarUrl(trimmed)) {
    return trimmed;
  }
  if (looksLikeAvatarPath(trimmed)) {
    return trimmed;
  }
  if (!/\s/.test(trimmed) && trimmed.length <= 4) {
    return trimmed;
  }
  return undefined;
}

function normalizeEmojiValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_ASSISTANT_EMOJI) {
    return undefined;
  }
  let hasNonAscii = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed.charCodeAt(i) > 127) {
      hasNonAscii = true;
      break;
    }
  }
  if (!hasNonAscii) {
    return undefined;
  }
  if (isAvatarUrl(trimmed) || looksLikeAvatarPath(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function resolveAssistantIdentity(params: {
  cfg: OpenClawConfig;
  agentId?: string | null;
  workspaceDir?: string | null;
}): AssistantIdentity {
  const agentId = normalizeAgentId(params.agentId ?? resolveDefaultAgentId(params.cfg));
  const workspaceDir = params.workspaceDir ?? resolveAgentWorkspaceDir(params.cfg, agentId);
  const configAssistant = params.cfg.ui?.assistant;
  const agentIdentity = resolveAgentIdentity(params.cfg, agentId);
  const hizalEnabled = resolveAgentHizalConfig(params.cfg, agentId)?.enabled === true;
  const hizalIdentity =
    workspaceDir && hizalEnabled ? readHizalIdentitySnapshotSync(workspaceDir) : null;
  const fileIdentity = workspaceDir ? loadAgentIdentity(workspaceDir) : null;

  const name =
    (hizalEnabled
      ? coerceIdentityValue(hizalIdentity?.name ?? hizalIdentity?.title, MAX_ASSISTANT_NAME)
      : (coerceIdentityValue(configAssistant?.name, MAX_ASSISTANT_NAME) ??
        coerceIdentityValue(agentIdentity?.name, MAX_ASSISTANT_NAME) ??
        coerceIdentityValue(fileIdentity?.name, MAX_ASSISTANT_NAME))) ??
    DEFAULT_ASSISTANT_IDENTITY.name;

  const avatarCandidates = hizalEnabled
    ? [
        coerceIdentityValue(hizalIdentity?.avatar, MAX_ASSISTANT_AVATAR),
        coerceIdentityValue(hizalIdentity?.emoji, MAX_ASSISTANT_AVATAR),
      ]
    : [
        coerceIdentityValue(configAssistant?.avatar, MAX_ASSISTANT_AVATAR),
        coerceIdentityValue(agentIdentity?.avatar, MAX_ASSISTANT_AVATAR),
        coerceIdentityValue(agentIdentity?.emoji, MAX_ASSISTANT_AVATAR),
        coerceIdentityValue(fileIdentity?.avatar, MAX_ASSISTANT_AVATAR),
        coerceIdentityValue(fileIdentity?.emoji, MAX_ASSISTANT_AVATAR),
      ];
  const avatar =
    avatarCandidates.map((candidate) => normalizeAvatarValue(candidate)).find(Boolean) ??
    DEFAULT_ASSISTANT_IDENTITY.avatar;

  const emojiCandidates = hizalEnabled
    ? [
        coerceIdentityValue(hizalIdentity?.emoji, MAX_ASSISTANT_EMOJI),
        coerceIdentityValue(hizalIdentity?.avatar, MAX_ASSISTANT_EMOJI),
      ]
    : [
        coerceIdentityValue(agentIdentity?.emoji, MAX_ASSISTANT_EMOJI),
        coerceIdentityValue(fileIdentity?.emoji, MAX_ASSISTANT_EMOJI),
        coerceIdentityValue(agentIdentity?.avatar, MAX_ASSISTANT_EMOJI),
        coerceIdentityValue(fileIdentity?.avatar, MAX_ASSISTANT_EMOJI),
      ];
  const emoji = emojiCandidates.map((candidate) => normalizeEmojiValue(candidate)).find(Boolean);

  return { agentId, name, avatar, emoji };
}
