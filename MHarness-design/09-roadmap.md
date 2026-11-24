# Mesa — 12-Week Roadmap

Team assumption: 2 full-stack engineers, 1 designer, 1 part-time product. Desktop-first (Electron), Web build follows the host API.

## Weeks 1–4 — MVP: "Talk, see the work, verify it"

| Week | Scope | Exit criterion |
|---|---|---|
| 1 | Host: ledger (SQLite), JSON-RPC over WS, session CRUD, model adapter for one provider. Client: AppShell, RailNav, Thread (virtualised), Composer, streaming markdown/code. | A session streams at 60 fps with 1 000-event ledger. |
| 2 | Tool-call pipeline with `conversation.tool` registry; renderers for bash, edit (DiffRow + Files tab + Monaco diff), read, image. ApprovalTakeover with presets + dangerous-command detection. | Agent edits 5 files; user approves and reviews every hunk in the dock. |
| 3 | Run system core: PTY terminal tabs, background jobs, inline Run button, `host` + `sandbox` runtimes, RunCards with preset badge. Test runner (vitest/pytest) with TestRunnerView. | Dev server + tests run from the UI; failures jump to line. |
| 4 | Showcase: `present` tool, DeliverableCard, ShowcaseWindow with motion + DND, ArtifactsTab, Gallery (pin + filter), command palette, keyboard map, settings pages. | A turn produces 3 deliverables → showcase → verify → pin. |

**Explicit MVP cuts**: no subagents UI, no Preview iframe, no notebooks, no automations, no publish, no browser tab, no plugin SDK (internal slot registry only), no ACP, light theme only + dark tokens defined.

## Weeks 5–8 — v1: "Run it, show it, share the work"

| Week | Scope |
|---|---|
| 5 | Preview pane (iframe isolation, proxy, device sizes, console/network via CDP), one-click app runner (framework detector, deps, port detect), screenshot-to-chat, send-element-to-agent. |
| 6 | Plugin SDK public: manifest loader, SlotRegistry, tool presentation + artifact renderer APIs, settings schema, theme scoping; migrate 3 internal panels to plugins as proof. Dark + high-contrast themes. |
| 7 | Agents: subagent tree, AgentsTab, split parent/child view, message-a-child, fork-from-step; Goals (GoalBar) + PlanCard review; Timeline tab with checkpoints + restore. |
| 8 | Stats tab (tokens/time/cache/cost per turn), session export (JSONL/ZIP/MD) with secret masking, FTS5 session search, hover peeks, tray, notifications, Automations (RRULE tasks). |

**v1 cuts**: remote runtime, browser tab, canvases, notebooks, publish, ACP, touch layout.

## Weeks 9–12 — v2: "A platform with ceremony"

| Week | Scope |
|---|---|
| 9 | Canvases (agent-authored views, Gallery re-run, skill themes), diff theatre + delivery ceremony polish, before/after compare. |
| 10 | Browser tab (Playwright MCP/CDP), NotebookView + kernel runtime, 3D/video/audio renderers. |
| 11 | Publish with preflight + secret handles, share links, remote runtime (SSH), local↔cloud handoff (session bundle export/import). |
| 12 | ACP plugin (embed Claude Code / Codex / Gemini), agent presets/compositions editor, worktrees per task, touch layout, performance pass against budgets, public docs. |

**Post-v2 parking lot**: multi-user live share, mobile app, plugin marketplace with signing, LLM auto-review of outputs (not just tool calls).

## Cut discipline
Every feature names its off-switch and its "verify" link. If a feature cannot be verified by the user in one click (diff / preview / test / re-run), it does not ship.
