---
title: "TOOLS.md Template"
summary: "Workspace template for TOOLS.md"
read_when:
  - Bootstrapping a workspace manually
---

# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Hizal MCP

If this workspace is configured for Hizal, use the Hizal MCP tools as your remote context system.

### Source of Truth

- Hizal identity is your primary identity source
- Hizal memory is your primary long-term memory/search source
- Local markdown files can still hold workspace notes, but they are not the authoritative memory layer when Hizal is enabled

### Session Lifecycle

- `start_session` — begins a session and returns inject-audience-matching chunks for the agent
- `get_active_session` — recover the current session id after context reset or reconnect
- `resume_session` — extend session TTL and re-inject matching chunks
- `register_focus` — declare current task and tags; enables focus-tag-based chunk injection when configured
- `end_session` — close the session and return SURFACE chunks for consolidation review

### Read/Search

- `search_context` — semantic search across all accessible scopes (project, agent, org), filterable by `chunk_type`, `scope`, `agent_id`, `project_id`, `org_id`, `query_key`, and more
- `read_context` — fetch a specific chunk by `id` or `query_key`
- `compact_context` — retrieve related chunks for agent-side synthesis (read-only)
- `get_context_versions` — inspect version history for a chunk

### Write (Purpose-Built)

- `write_identity` — agent-scoped identity
- `write_memory` — agent-scoped episodic memory
- `write_knowledge` — project-scoped knowledge
- `write_convention` — project-scoped conventions and patterns
- `write_org_knowledge` — org-scoped knowledge
- `store_principle` — org-scoped principles; requires human promotion
- `write_chunk` — generic writer for custom chunk types

### Modify/Delete

- `update_context` — update an existing chunk with versioning
- `review_context` — submit usefulness and correctness feedback
- `delete_context` — delete a chunk and all versions

### Admin/Orchestrator

- `list_projects`, `create_project`
- `list_agents`
- `add_agent_to_project`, `remove_agent_from_project`

### Hizal Working Rules

- Prefer `search_context` before assuming you remember something
- Use `write_memory` instead of saying you will remember something later
- Use `read_context` when you already know the exact chunk/query key
- Use `compact_context` when preparing a synthesis or briefing
- Use session lifecycle tools intentionally; do not leave long-running work floating without a session plan
- Keep writes concise, specific, and reusable
- Do not delete or overwrite context casually; prefer versioned updates and reviews

### How `inject_audience` Works

`inject_audience` controls deterministic automatic injection at session start and resume.

- Chunks with matching `inject_audience` rules are injected automatically during `start_session` and `resume_session`
- Chunks without `inject_audience` are search-only
- The rule format is disjunctive normal form (DNF): rules are OR'd together, conditions within one rule are AND'd together

Example:

```json
{
  "rules": [{ "agent_types": ["dev"], "project_ids": ["proj-abc"] }, { "agent_ids": ["agent-xyz"] }]
}
```

This means:

- inject when the agent is type `dev` and working on project `proj-abc`
- or inject when the agent is specifically `agent-xyz`

Available predicates include:

- `all`
- `agent_ids`
- `agent_types`
- `project_ids`
- `org_ids`
- `agent_tags`
- `focus_tags`
- `lifecycle_types`

Important defaults to remember:

- `IDENTITY` is typically always injected for the owning agent
- `MEMORY` is typically search-only unless explicitly given injection rules
- `focus_tags` rules only matter after `register_focus(...)`

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
