# Changelog

All notable changes to Mesa are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Fence-based tools for models without native tool calling** (Strata): a ` ```bash ` fence in the model's answer becomes a real tool row behind the approval takeover (auto-review included), runs on the host, and its output is fed back as the next message for up to three rounds. Verified with the real Strata model (`ls -1 .` → follow-up commands of its own).
- Windows real shell: `head`, `tail`, `wc -l`, `touch`, `mkdir -p`, `rm -rf` are rewritten to PowerShell/cmd equivalents (covered by the smoke test on all three OSes).
- Settings shows a "fence-based tools on" badge when native tool calling is off, and the empty state suggests shell tasks first for those models.

### Changed
- Toasts anchor just above the composer (tracking its height) instead of under the header, so they never cover the showcase title or the composer controls.
- Long sessions render their last 30 turns first with a "Show earlier turns" button (keeps the thread fast at any length).
- Pressing **N** reuses an untouched "New session" instead of piling up empty duplicates.
- **Session peek**: hover a session in the rail to see its last question, the start of the last answer and turn/artifact counts.
- Keyboard everywhere: **↑/↓** move between sessions in the rail (Enter opens), the completion showcase takes **←/→** to highlight a card and **Enter** to open it, and clicking a system notification brings its session to the front.
- **Checkpoints rewind for real**: "Before present" (and any other checkpoint) in the Timeline now rewinds the session — turns, artifacts and runs after it are removed, the timeline records the rewind (it was a placeholder toast). The Timeline also gained filter chips (turns · tools · runs · approvals · artifacts · checkpoints).

### Fixed
- **"Always allow for this repo" now sticks**: the approval scope is remembered per tool for the workspace (dangerous shell patterns still prompt; ACP permission requests can be remembered too), and Settings → Permissions lists the rules with a revoke button — previously the choice only allowed the one command.
- **Auto-review tool calls is real**: before a live shell approval is shown, the configured model returns a one-line risk verdict ("low — read-only command…") that sets the risk label and rationale in the takeover (6 s budget; off or unavailable → static rationale). The Settings toggle was previously a dead switch.

## [0.3.0] — 2026-11-24

### Added
- **Undo** for deleted sessions (7-second toast action).
- **Drag and drop** files onto the composer to attach them; dropped HTML/SVG files open directly in the preview.
- **URL routing** — #/s/<session>/<tab> deep links restore the active session and dock tab on reload or from a bookmark.
- Palette commands for accent colours and density; **token sparkline** in Stats; cost estimates marked as estimated or unpriced.
- **? shortcut cheat sheet** (searchable, respects overrides) and **empty-state calls to action** in every dock tab.
- Approval scope **allow for this session** (between once and always-for-repo) for live shell commands.
- **ACP bridge (experimental)** — drive external agents (Claude Code, Codex, Gemini CLI…) over the Agent Client Protocol: streamed messages and thoughts, tool rows, permission requests in the approval takeover, cancel. Ships with a reference agent (`scripts/mock-acp-agent.mjs`).
- Toasts moved under the header so they can never cover the composer's Stop button.
- **Notebook execution (#7)** — Run / Run all on notebook cells executes them in one real Python process on the Mesa host (state carries between cells, per-cell tracebacks, timeouts); the run is recorded in the Run console and the cells fill with live output. Opt in with `"notebook": { "command": "python" }`.
- `serve.mjs` survives a throwing request handler (logged, not fatal).
- Live **tok/s** readout under the context meter while a turn streams.
- **Copy** on finished turns (Markdown to the clipboard) beside Retry / Edit.
- **Desktop shell (experimental, #6)** — `MHarness/desktop`: Electron window that starts the Mesa server and loads the built app; `pnpm smoke` verifies it loads. Could not be launched from the build environment's sandbox, so it awaits a report from a real desktop.
- **Error boundaries** around every pane and dialog (recovery card: Retry / Copy details / Reset workspace) and **global error toasts** for uncaught errors and rejected promises.
- Palette: New terminal, Pin / Beside chat / Publish the latest artifact, Keyboard cheat sheet.
- **Focus traps** in the publish dialog, cheat sheet, gallery and palette: focus moves in on open, Tab/Shift+Tab cycle inside, and focus returns to the trigger on close.
- Gallery: Notebook filter chip.
- Hover any tool row to peek what it printed (like the diff chips); boot and session-switch transitions; the context meter pulses while a turn streams (all honour `prefers-reduced-motion`).
- **Real attachments**: `@name` in a prompt resolves against the session's artifacts and the file contents are sent to the model or ACP agent (truncated at 4,000 chars each), with chips under the message showing what was attached.
- Regression-checked live mode against the real local Strata endpoint (model list via the proxy, streamed answer, fenced HTML → app artifact + showcase).
- **Automations are real**: schedule a prompt every N minutes/hours into a chosen or fresh session; live countdown, last-run time, Run now, pause and delete; the scheduler runs while Mesa is open.
- **Skills are real**: save reusable prompts in Plugins & Skills and expand them with `/name` in the composer (trailing text is appended); plugin toggles persist; `/export` now downloads the JSONL ledger and `/share` opens Publish for the latest HTML deliverable (both were placeholder toasts).
- **Browser tab is real**: framed browsing of the session's app or any URL with back / forward / reload, open-in-new-tab and a navigation log; Preview's open button opens the deliverable in a real new tab; Gallery's "Re-run" re-sends the prompt that produced the deliverable.
- Regression sweep after 30 rounds (~45 checks across shell, rail, header, every dock tab, approvals, showcase, terminal, diffs, exports, themes, resizing, extreme viewports, rapid switching, queue/inject/stop, validation, delete/undo, corrupted and empty storage, XSS): one finding fixed — Markdown no longer renders non-http(s) links as anchors (`javascript:` and relative schemes become plain text).

### Fixed
- Preview tab kept the segment chosen in a previous session (could show a code doc instead of the session's app); it now resets to each session's headline deliverable and never points at a segment the session lacks.

## [0.2.0] — 2026-11-24

### Added
- **Real shell for live agents** — an agent's `bash` tool can run for real on the machine hosting `serve.mjs` (opt-in via `"shell": true` or `MESA_SHELL=1`), confined to the repository, with exit codes, timeouts and the approval takeover in front of every command. Windows uses `cmd.exe` with POSIX aliases (`ls`, `cat`, `pwd`…); macOS/Linux use `$SHELL -c`.
- **Cross-platform** — CI matrix on Ubuntu, macOS and Windows with a real-shell smoke test (`pnpm smoke`); physical-key shortcuts that work on every layout; ⌘/⌥ labels and ⌃ secondary chords on macOS.
- **Keyboard shortcut editor** — record chords, conflict rejection, per-row and global reset (#2).
- **Publish with preflight** — scans HTML deliverables for secrets, source maps and untrusted scripts before hosting them at a local link (#4).
- **Notebook renderer** — `.ipynb` deliverables with `In [n]` cells, markdown, outputs (HTML sandboxed) and "Convert to script"; the revenue demo ships one (#3).
- **Canvas beside chat** — a resizable live pane for app, chart and notebook deliverables; the rail auto-collapses to make room.
- **Guided tour** on first run, replayable from Settings and the palette; **accent colour** picker (six palettes); **hold Ctrl/⌘ to reveal shortcut badges**.
- **Cross-browser persistence** — the workspace state file (`mesa.state.json`, git-ignored) mirrors every save; fresh browsers restore from it.
- **Retry / Edit** on completed turns; session search matches message content; live-mode suggestions in the empty state.
- `pnpm shots` regenerates every README screenshot from a deterministic demo run.

### Fixed
- Fifteen issues found by the systematic QA pass: active-session click on pages, showcase blocking new sessions, Esc not denying approvals, terminal `clear`, swallowed shortcuts from the terminal, stuck resize handles, clipped rail handle, grid overflow with long content, stale provider responses, false "request failed" on cancel, seed-time toasts, missing document title, hover peeks intercepting clicks, pnpm build-script approval in CI.

## [0.1.0] — 2026-11-24

Initial public build: three-pane shell, streaming thread with tool rows, approval takeover, completion showcase, right dock (artifacts, xterm console, sandboxed preview, files & diffs, agents, stats, timeline, browser), gallery, command palette, settings, Z.AI / Strata / OpenAI-compatible providers with tool calling, offline mock model, persistence, exports, light/dark themes, responsive layout.
