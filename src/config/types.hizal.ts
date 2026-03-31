export type HizalAgentConfig = {
  /** Enable Hizal-backed identity and session lifecycle for this agent. */
  enabled?: boolean;
  /** Hizal lifecycle preset to use when starting a session. */
  lifecycleSlug?: string;
  /** Optional default Hizal project id for this agent. */
  projectId?: string;
  /** MCP server name for Hizal (default: "hizal"). */
  serverName?: string;
};
