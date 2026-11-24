# Mesa — Component Inventory

Priority: **MVP** (weeks 1–4), **v1** (weeks 5–8), **v2** (weeks 9–12). Slot = the plugin slot the component registers into (see `08-plugin-api.md`).

| Component | Purpose | States | Slot | Priority |
|---|---|---|---|---|
| `AppShell` | Three-pane layout with drag handles | rail expanded/collapsed; dock open/closed/floating | `shell.root` | MVP |
| `RailNav` | Workspace switcher + session tree + nav | search active; groups collapsed; drag-reorder | `shell.rail` | MVP |
| `SessionRow` | One session in tree | idle / running / awaiting-approval / has-deliverables / error; hover actions | `shell.rail.session` | v1 |
| `SessionHeader` | Title, mode pill, model picker, goal bar, token meter, job chip | streaming / idle / goal-active / jobs-running | `conversation.header` | MVP |
| `Thread` | Virtualised turn list | idle / streaming / scrolled-up ("jump to latest") | `conversation.thread` | MVP |
| `TurnCard` | One turn: user bubble + agent answer | streaming / done / error / cancelled | `conversation.turn` | MVP |
| `StepTree` | Steps → tool calls, collapsible | collapsed / expanded / running / failed | `conversation.turn.steps` | MVP |
| `ToolCallRow` | One tool call with per-tool renderer | queued / running / awaiting-approval / success / error / denied | `conversation.tool` (keyed by tool name) | MVP |
| `BashOutput` | stdout/stderr with ansi, truncation, "open in console" | collapsed (last 10 lines) / expanded | `tool.bash` | MVP |
| `DiffRow` | Inline diff summary chip `[+42 −7]` → hover peek → open in Files tab | clean / modified / conflict | `tool.edit` | MVP |
| `ImageResult` | Thumbnail + lightbox | loaded / loading | `tool.read_image` | v1 |
| `PlanCard` | Plan with review button, todo list | draft / awaiting-review / approved / superseded | `conversation.composer.above` | MVP |
| `GoalBar` | Persisted goal with progress | active / paused / complete / blocked | `conversation.header.goal` | v1 |
| `Composer` | Input with `@`, `/`, attach, mode, model, send/queue/inject | idle / streaming (send→inject) / approval-takeover / disabled | `conversation.composer` | MVP |
| `ApprovalTakeover` | Replaces composer during approval | pending / decided / remembered | `conversation.composer.takeover` | MVP |
| `QueuedMessages` | Stack of queued messages | queued / sending / editable | `conversation.composer.below` | v1 |
| `TokenMeter` | Context fill arc + cache hit % | normal / > 80 % / > 95 % | `conversation.header.right` | v1 |
| `DockPanel` | Right dock tab host | docked / floating / collapsed; tab overflow | `shell.dock` | MVP |
| `ArtifactsTab` | Grid of artifacts + changed files list | empty / loading / filtered | `dock.tab` (id `artifacts`) | MVP |
| `DeliverableCard` | Hero card for one deliverable | thumbnail loading / ready / verify-pass / verify-fail | `showcase.card` | MVP |
| `RunConsole` | Terminal tabs + background jobs | no-terminals / running / exited | `dock.tab` (id `run`) | MVP |
| `TerminalView` | xterm.js PTY | running / exited / read-only (agent-owned view) | `run.terminal` | MVP |
| `JobPanel` | Background job row → expandable stream | running / done / failed / killed | `run.jobs` | v1 |
| `PreviewTab` | iframe preview with device sizes, console/network | loading / ready / error / offline (server stopped) | `dock.tab` (id `preview`) | v1 |
| `BrowserTab` | Playwright-driven browser with console/network | idle / navigating / recording | `dock.tab` (id `browser`) | v2 |
| `FilesTab` | Tree + diff viewer (split/unified) | clean / dirty / conflict | `dock.tab` (id `files`) | MVP |
| `DiffViewer` | Monaco diff with hunk actions | split / unified / word-level | `files.diff` | MVP |
| `AgentsTab` | Subagent tree + task board | tree / board toggle | `dock.tab` (id `agents`) | v1 |
| `StatsTab` | Per-turn table: tokens / time / cache / cost | live / export | `dock.tab` (id `stats`) | v1 |
| `TimelineTab` | Event ledger with timing bars | live / scrubbing / checkpoint-selected | `dock.tab` (id `timeline`) | v1 |
| `ShowcaseWindow` | Floating completion window | entering / idle / minimised / leaving | `shell.overlay` | MVP |
| `HoverPeek` | Anchored preview card | loading / ready | `shell.overlay` | v1 |
| `CommandPalette` | Fuzzy action list | closed / open / scoped | `shell.overlay` | MVP |
| `GalleryView` | Cross-session deliverable gallery | grid / compare / detail | `rail.page` (id `gallery`) | v1 |
| `CanvasView` | Agent-authored interactive view | loading / ready / error / re-run | `artifact.canvas` | v2 |
| `PublishDialog` | Preflight + share link | checking / issues / ready / published | `shell.overlay` | v2 |
| `TestRunnerView` | Pass/fail tree → file line → "ask agent to fix" | running / passed / failed | `run.tests` | v1 |
| `NotebookView` | Cells with kernel status, inline outputs | idle / busy / error | `artifact.notebook` | v2 |
| `AutomationList` | Schedules + webhooks | active / paused / last-run status | `rail.page` (id `automations`) | v2 |
| `PluginManager` | Install/enable/disable bundles | loading / up-to-date / needs-restart | `rail.page` (id `plugins`) | v1 |
| `SettingsPages` | General, permissions, keyboard, theme, notifications | — | `rail.page` (id `settings`) | MVP |
| `Toast` | Transient notification | info / success / warning / error | `shell.toast` | MVP |
| `Tray` | Bottom-left stack of minimised windows | empty / stacked | `shell.tray` | v1 |
| `EmptyState` | Per-tab empty content with CTA | — | each tab | MVP |
