# Mesa — developer guide

Working MVP of the design in [`../../MHarness-design`](../../MHarness-design/README.md). The product overview, screenshots and feature tour live in the [repository README](../../README.md).

## Run it

Works on Windows, macOS and Linux with Node ≥ 18.

```bash
pnpm install            # hoisted linker + esbuild build approval live in pnpm-workspace.yaml
pnpm build              # vite build → dist/
pnpm serve              # zero-dependency static server + model proxy + offline mock → http://127.0.0.1:5173
pnpm typecheck          # tsc --noEmit
pnpm smoke              # boots serve.mjs with the real shell and checks it (same as CI)
```

`pnpm dev` (Vite dev server with HMR) also works, but `scripts/serve.mjs` is what hosts the model proxy (`/proxy`), the bootstrap config (`/__mesa/config`), the real shell (`/__mesa/run`, opt-in) and the offline mock model (`/__mesa/mock`). In sandboxed shells Vite's build needs esbuild to spawn a child process; run the build with wider permissions once, then serve `dist/` with `pnpm serve`.

## Configuration

- `mesa.config.json` (git-ignored) — first-run provider, agent mode and `"shell": true` for the real shell, served to the app on launch.
- `MESA_SHELL=1` — enable the real shell without touching the config file.
- `PROXY_ALLOW=host1,host2` — extra hosts for the model proxy allow-list.
- `PORT` — server port (default 5173).

## Platforms

| | Windows | macOS / Linux |
|---|---|---|
| Real shell | `cmd.exe /d /s /c`, verbatim quoting, `ls`/`cat`/`pwd`/`clear`/`which` aliases | `$SHELL -c` (bash, zsh, fish…) |
| Workspace boundary | case-insensitive prefix check | case-insensitive on macOS, exact on Linux |
| Shortcuts | Ctrl / Alt labels | ⌘ / ⌥ labels; chords are matched by physical key (`e.code`) so Option+A does not type "å" |
| Terminals | xterm.js tabs; simulated shell for user terminals (identical on every OS) | same |

## What is implemented

| Area | Status |
|---|---|
| **Shell** | Resizable rail / center / dock with drag handles (pointer-capture safe), collapsed rail, auto-collapse under 960 px, dock float toggle, light / dark / system themes, density modes |
| **Ledger-backed store** | Append-only session timeline; every pane is a projection (`src/state/store.ts`); localStorage persistence with interrupted-turn recovery |
| **Thread** | User bubbles, streamed markdown (code fences with Copy/Run, tables, lists), reasoning row, tool-call rows with per-tool icons, diff chips with hover peeks, collapsible output, scroll anchoring, timeline → row flash |
| **Composer** | Enter send · Shift+Enter inject · Alt+Enter queue, `/` slash menu, `@file` refs, attach files, plan card, queued messages, Stop |
| **Approval takeover** | Command with flagged tokens, auto-review rationale, allow once / always for repo / deny with reason, Esc-deny flow, cancel turn, Alt+A / Alt+R |
| **Showcase** | Slides in on deliverables; hero cards with live thumbnails, verified badge, stagger, accent sweep, confetti, Verify row, pin/share/re-run, minimise to tray, do-not-disturb, auto-minimise on new session |
| **Right dock** | Artifacts & changed files (hover peeks) · Run console (xterm, simulated shell, background jobs) · Preview (sandboxed iframe, devices, console/network, ad-hoc run from chat) · Files & diffs (split/unified, Explain this hunk) · Agents (tree/board) · Stats · Timeline · Browser |
| **Gallery** | Cross-session grid, filters, search, detail, live compare, re-run |
| **Palette** | Ctrl+K fuzzy commands; global shortcut map (capture-phase, works from the terminal) |
| **Pages** | Settings (appearance, notifications, agent/provider, export/reset, shortcuts), Plugins, Automations |
| **Providers** | OpenAI-compatible SSE with tool calling; presets Z.AI / Strata / OpenAI / Custom / Mesa mock; first-byte watchdog; CORS-free proxy |
| **Export** | JSONL ledger and Markdown transcript downloads |

### Demo scenarios (scripted agent)

Type one of these in a new session (or pick from the empty-state suggestions / command palette): *build a dashboard app* (plan, diffs, install approval, dev server, preview, 3 deliverables), *analyse revenue → chart*, *run tests and fix failures*, *rename Series → TimeSeries with subagents*, or anything with *goal / ship / keep going* for a persisted goal.

The agent is a scripted simulator (`src/agent/scenarios.ts`) so the whole UI works offline. Live mode goes through `src/agent/provider.ts`; the mock endpoint in `scripts/serve.mjs` speaks the same protocol (including `tool_calls`) and honours `echo:` prompts for rendering tests.

## Layout

```
src/
  state/      types, event-sourced store + agent runner (demo + live)
  agent/      provider adapter, scripted scenarios
  components/ Rail, Header, Thread, Composer, Dock tabs, RunConsole, Showcase, Palette, Gallery, Pages, Confetti
  styles/     design tokens (--mesa-*) and component CSS
scripts/      serve.mjs (static server + proxy + mock model)
```
