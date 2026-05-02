# Vendored Agent Roster

Source: `mac-reichelt/tuning-coach/.github/agents/` (vendored from `~/.copilot/agents/` on the dev box).
Source commit: `f8d9b6ac05b131aabaa6cc11651403312b027d75`
Synced: 2026-04-26

These are vendored copies of the canonical team roster. The GitHub
Copilot coding agent reads them from this directory. To update, re-sync
from `mac-reichelt/tuning-coach` at a new commit SHA.

## Versions

| Agent | Version | Source SHA |
|-------|---------|------------|
| coordinator | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| producer | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| architect | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| software-engineer | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| qa-engineer | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| devops-engineer | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| tech-writer | 0.1.0 | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| code-review | ? | f8d9b6ac05b131aabaa6cc11651403312b027d75 |
| security-review | ? | f8d9b6ac05b131aabaa6cc11651403312b027d75 |

## Excluded Agents

The following tuning-coach-specific domain agents were intentionally excluded
as they are not relevant to the game-club stack:

- `telemetry-expert.agent.md` — Forza UDP packet schema, sim physics
- `race-engineer.agent.md` — Real-world tuning knowledge

## Local Overrides

The following agents intentionally diverge from the upstream
`~/.copilot/agents/` roster and are excluded from sync (see
`.sync-overrides`):

- `security-review` — Customized to defer to CodeQL on OWASP A02/A03/A05/A06/A10
  (CodeQL gates BP on this repo). Refocuses LLM review on business logic,
  auth flow, info leak — categories CodeQL can't see. Do not re-sync.
