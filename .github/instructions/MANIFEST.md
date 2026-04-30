# Vendored Copilot Instructions

Source: `mac-reichelt/tuning-coach/.github/instructions/`
Source commit: `f8d9b6ac05b131aabaa6cc11651403312b027d75`
Synced: 2026-04-26

These `*.instructions.md` files are read by GitHub Copilot whenever the file
being edited matches the `applyTo:` frontmatter glob. Two sources:

1. **`awesome-copilot/`** — vendored copies from
   [github/awesome-copilot](https://github.com/github/awesome-copilot).
   Re-vendor manually when originals change.
2. **`homelab-copilot/`** — vendored from `mac-reichelt/homelab-copilot`
   notes (`notes/copilot/*.md`). These capture lessons from the agent
   automation pipeline and the cloud `copilot-swe-agent` workflow.

| File | Source | applyTo |
|---|---|---|
| `security-and-owasp.instructions.md` | awesome-copilot/instructions/ | `**` |
| `ai-prompt-engineering-safety-best-practices.instructions.md` | awesome-copilot/instructions/ | `*` |
| `containerization-docker-best-practices.instructions.md` | awesome-copilot/instructions/ | `**/Dockerfile,**/compose*.yml,...` |
| `llm-workflow-hardening.instructions.md` | homelab-copilot/notes/copilot/llm-workflow-hardening.md | `.github/workflows/**` |
| `llm-workflow-payload-limits.instructions.md` | homelab-copilot/notes/copilot/llm-workflow-payload-limits.md | `.github/workflows/**` |
| `cloud-agent-ci-gate.instructions.md` | homelab-copilot/notes/copilot/cloud-agent-ci-gate.md | `**` |
| `cloud-agent-dirty-pr.instructions.md` | homelab-copilot/notes/copilot/cloud-agent-dirty-pr.md (adapted for Next.js/TypeScript) | `**` |
