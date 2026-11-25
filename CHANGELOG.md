# Changelog

All notable changes to Mesa are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
