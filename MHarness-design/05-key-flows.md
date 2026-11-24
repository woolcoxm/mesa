# Mesa — Interaction Specs for the 12 Key Flows

Each flow: happy path → edge cases → shortcut. "Inspired by" names the harness that proved it.

### 1. Start a session and get a first result
Happy: `Ctrl+N` → session opens with composer focused → type → `Ctrl+Enter` → stream → answer. Header shows token meter after first step.
Edge: workspace has no folder open → composer shows a "Choose folder" inline CTA before sending. Model unavailable → model picker marks it red and suggests a fallback. Empty message → send disabled (tooltip "Type a message or attach a file").
Inspired by: Cursor Agents Window (agent-first empty state).

### 2. Steer while the agent is running (queue vs inject)
Happy: agent streaming → user types → two buttons appear: **Queue** (`Alt+Enter`, sends when turn ends) and **Inject** (`Shift+Enter`, delivered at the next tool call). Queued messages stack above the composer with an ✎ edit and ✕ cancel.
Edge: turn ends before the queued message is sent → it auto-sends. Inject during a tool call that takes > 30 s → delivered after the result. Agent is in Plan mode → inject forces a plan re-review.
Inspired by: Cursor "send follow-up now".

### 3. Approve a shell command
Happy: tool call → `ApprovalTakeover` replaces the composer: command (highlighted), cwd, runtime, preset, rationale (from auto-review if on) → `Alt+A` allow → composer restores, scroll position preserved.
Edge: approval arrives while user is typing → draft is preserved in the takeover ("Draft saved"). User presses Esc → treated as *Deny* with reason "dismissed by user". Two approvals pending → shown as a queue with counter "1 of 2".
Inspired by: DSH approval takeover.

### 4. Review a diff and explain a hunk
Happy: Diff chip `[+42 −7]` → hover peek (300 ms) → click → Files tab opens at the file with the DiffViewer split → "Explain this hunk" → composer gets `@hunk:` ref → send.
Edge: file is binary → shows "Binary changed" with size delta and open-in-app. Huge diff (> 3 000 lines) → "Load in chunks" with virtualised hunks. Hunk was reverted by the agent meanwhile → stale banner with "Reload".
Inspired by: DSH changed-files card, Cursor inline diffs.

### 5. Run the app the agent just wrote
Happy: agent finishes → Showcase → hero card shows `[Run app]` (framework detected) → click → Install deps (progress, lockfile detected) → dev server job → port detected → Preview tab opens with device chips.
Edge: install fails → RunCard red with last 30 lines + "Ask agent to fix". Port detection fails → "Enter port" input with the detected candidates. Preview crashes → error overlay with "Open console" and "Restart server".
Inspired by: Replit Run button, Cursor preview.

### 6. Run tests and fix a failure
Happy: Showcase shows `✓ tests pass` or `✗ 2 failing` → click → TestRunnerView tree → click failure → Files tab at line → "Ask agent to fix" → agent edits → diff appears → "Re-run tests" chip in header.
Edge: no test command detected → "Set test command" inline input (remembered per repo). Tests hang → 2-min timeout with "Kill" and "Run with `--watch=false`" suggestion.
Inspired by: Cline checkpoints + Cursor checkpoints.

### 7. Restore a checkpoint
Happy: Timeline tab → checkpoint markers (auto before each destructive step: file delete, `git`, package install) → click → modal with diff summary since → Restore → workspace reset, ledger gets `checkpoint_restored`, thread shows a divider "Restored to 10:42".
Edge: uncommitted user edits after the checkpoint → modal offers "Keep my edits (stash)" vs "Discard". Restore fails (file locked) → partial restore banner with "Retry".
Inspired by: Cursor checkpoints, Cline checkpoints.

### 8. Pin and find a deliverable in the Gallery
Happy: Showcase → Pin → Gallery (`Ctrl+Shift+G`) → filter by kind `chart` → open → "Re-run with fresh inputs" → form → new version → compare.
Edge: artifact blob missing (pruned) → card shows "Content pruned" with "Re-create via agent". Two versions share a path → compare button auto-suggests the pair.
Inspired by: Cursor Canvases, Claude artifacts.

### 9. Create a Task from a run and schedule it
Happy: Run card ⋮ → "Save as Task" → params (e.g. `since=30d`) → schedule "every weekday 09:00" → Automations page shows it. Next morning: new session appears with `automation` tag and a Showcase.
Edge: schedule fires while offline → runs on next launch (one catch-up, latest only). Task's repo was removed → Automation marked "Needs workspace".
Inspired by: DSH schedules (RRULE), OpenHands automations.

### 10. Watch and steer a subagent
Happy: Agents tab → tree with status, elapsed, cost → click child → opens its session in a *split* (parent | child) → composer shows "Message agent-3" → send → child receives at next step → "Fork from here" creates a sibling child at that step.
Edge: child crashed → red node with "Restart child" (resumes from last ledger event). Cost budget exceeded → child paused with "Increase budget".
Inspired by: DSH subagent tree, Cursor Projects.

### 11. Publish a preview
Happy: Preview → "Publish" → PublishDialog: preflight (secrets, .env, source maps) → env vars form (values stored as secret handles) → "Publish" → link with 30-day expiry → copied.
Edge: preflight finds a secret → blocks with file:line and "Ask agent to fix". Build step fails → shows build log inline. Unauthenticated publish on a workspace with `mesa.publish: false` policy → disabled with policy reason.
Inspired by: Cursor Apps gating, Replit deployments.

### 12. Search across sessions and export
Happy: `Ctrl+K` → `# auth token` → sessions ranked by FTS5 → click → opens with the matching turn highlighted → `⋮ → Export` → JSONL / ZIP / Markdown (choice) → saved.
Edge: export includes images → ZIP only. Secret masking: values matching secret handles are replaced with `••••` in every export format; JSONL keeps redaction markers `{"redacted":true}`.
Inspired by: DSH session search + export.
