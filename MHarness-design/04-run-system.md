# Mesa — Run System

## Runtime matrix

| Runtime id | What it is | Isolation | Used for | Availability |
|---|---|---|---|---|
| `host` | User's shell (`pwsh` / `zsh`) via PTY | DSH sandbox (bwrap / landlock / Seatbelt / Windows ACL) per permission preset | builds, tests, git, scripts | Desktop + Web (host = the machine running Mesa) |
| `sandbox` | Disposable container (Docker / Podman) mounting the workspace read-write, network off by default | container | untrusted code, dependency installs from lockfile | Desktop with Docker |
| `remote` | SSH host or cloud workspace | remote machine | GPU jobs, cloud dev boxes | v2 |
| `kernel` | Jupyter kernel (Python 3.x, bundled env) | process + sandbox | notebooks, data steps | bundled Python |
| `node-bundled` | Bundled Node + pnpm | process + sandbox | scripts, one-off TS | bundled |
| `static` | Static file server for HTML/SVG/build output | process | previews | always |

Runtime picker order: last used → `host` → `sandbox` → `kernel`. The picker is remembered per artifact kind.

## Execution paths

### 1. Inline Run (`Ctrl+Enter` / Run button on a code block or file)
1. Quick Run popover: runtime chips, env overrides (`KEY=value` rows), "Pin to console" checkbox (default on).
2. On Run: a **Run** is created (`RunCard` inline under the block) with header `[runtime] command · status · duration`; output streams into it *and* into a Run console tab.
3. RunCard actions: `Open in console`, `Kill`, `Re-run`, `Pin to Gallery` (if output is an artifact).
4. Exit code colour: 0 → green check; ≠ 0 → red with last 20 stderr lines pre-expanded.

### 2. Interactive terminal tabs (PTY)
- Per session, user-owned tabs (`Ctrl+Alt+T`). Implemented with node-pty + xterm.js; 256-colour, mouse, bracketed paste, URL link detection.
- **Agent-owned terminals** (created by the agent's `terminal` tool) appear in the console with an 👤 agent badge; the user can *watch* but input is disabled unless the user clicks **Take over** (which the agent sees as a `user_took_over` event).
- **User-owned terminals** are visible to the agent **read-only** (last 200 lines) only if `Settings → Privacy → Agent can read user terminals` is on (default off).
- Scrollback 10 000 lines per tab; "Save log" exports `.log`.

### 3. Background jobs
- Any command started with "run in background" (agent tool `run_in_background` or user `Alt+Ctrl+Enter`) becomes a `Job`.
- Header chip `⚡ N` → popover list: name, elapsed, status, last line; click → opens a streaming panel in Run console; `Kill`, `Restart`, `Notify when done` (system notification + toast + Showcase if artifacts).

### 4. One-click app runner
- Framework detector on `package.json` / `pyproject.toml` / `requirements.txt`: `vite`, `next`, `remix`, `nuxt`, `astro`, `flask`, `fastapi`, `streamlit`, `django`, `rails`, `express`.
- Flow: **Detect → Install deps** (uses lockfile; prompts if no lockfile) → **Start dev server** (background job) → **Detect port** (parse stdout for `localhost:(\d+)`, or scan opened ports after 3 s) → **Open Preview**.
- If a port is already in use by a previous run of the same app, offer "Reuse" vs "Restart".
- **Publish** (v2): PublishDialog runs preflight: scans for secrets (regex set + entropy), `.env` files in the bundle, source maps, `console.log` with PII patterns, mixed content; shows issues with "Ask agent to fix"; asks for environment variables/secret handles (stored in OS keychain, injected at runtime, never written to disk).

### 5. Notebook execution
- NotebookView: cells with status ring (idle / queued / busy / error). `Shift+Enter` runs cell + advance; "Run all" runs sequentially with a kernel-level cancellation.
- Outputs inline (text, image/png, HTML, errors with traceback). "Convert to script" produces a `.py` with `# %%` cell markers and opens a Run card.

### 6. Test runner
- Detector: `vitest`, `jest`, `playwright`, `pytest`, `go test`, `cargo test`, `dotnet test`, `rspec`, `phpunit`, `junit` XML.
- Runs the command as a job, parses output into a tree (file → describe → test). Click a failure → opens the file at the failing line in Files tab; **"Ask agent to fix"** inserts the failure text + file ref into the composer.
- Rerun button keeps the last filter (`-t "name"`).

### 7. Scheduled / repeatable runs (Tasks)
- "Save as Task" on any Run card or canvas → parameter form (name, description, params with defaults, schedule RRULE optional, target session "new" / "this").
- Tasks appear under **Automations** in the rail; each run creates a Session tagged `automation:<id>` with a **Deliverable summary** at the end.

## Permission model

**Presets** (composer pill + on every RunCard):

| Preset | Sandbox | Approval policy | Visual |
|---|---|---|---|
| **Read-only** | read-only FS, no network | every write/exec asks | grey pill, RunCards hatched border |
| **Workspace write** (default) | write inside workspace + tmp, network allow-list | asks for: outside-workspace writes, network hosts not allow-listed, install scripts | blue pill |
| **Full access** | none | asks only for dangerous commands | amber pill; header shows persistent banner |

**Per-action approval**: shows *what will happen* — for shell: the command with flagged tokens (`rm -rf`, `sudo`, `| sh`, `curl … | bash`, writes outside cwd) highlighted in red; for file writes: a mini diff. Decisions: `Allow once` / `Allow for this session` / `Always allow for this repo` (scope memory keyed by repo + command prefix, max 5 entries per repo, editable in Settings → Permissions) / `Deny` / `Deny with reason` (reason is sent to the agent).

**Dangerous-command detection**: pattern list + optional **LLM auto-review** (`Settings → Permissions → Auto-review`, a second model labels risk `low|medium|high` with a one-line rationale shown in the approval; `high` always asks). Auto-review cost is shown in Stats.

**RunCards always show** the preset they ran under and the runtime; a lock icon indicates the command was allow-listed by scope memory (hover shows which rule).
