# Mesa — Positioning & Risks

## Competitive positioning

| Competitor | What we copy | What we do better | What we skip |
|---|---|---|---|
| **DeepSeek Harness** | Plugin-built UI with named slots; `present` deliverables + changed-files card; approval takeover; event-sourced ledger; right-sidebar terminal/browser tabs; permission presets with scope memory | Showcase window with motion + Gallery across sessions; one-click app runner with framework detection and port discovery; verify-one-click on every card; cross-session before/after compare | Desktop/Headless/ACP/SDK *modes* at launch (ACP in v2); CoT translation; liveshare; forge |
| **Claude Code** | Permission modes; hooks; subagents; plan mode | GUI-first; visual deliverables; persistent gallery; multi-agent board | CLI-first experience (we have a terminal, not a CLI product); output styles |
| **Cursor (Agents Window)** | Agent-first multi-workspace rail; queue vs inject steering; checkpoints; inline browser tool; Canvases; preview tray gating | Deliverable hero cards with verification status; Tasks (parameterised re-runs) from any run; plugin-open UI; gallery | IDE editing (we integrate Monaco for diffs, not as an IDE); Bugbot/Slack mobile |
| **OpenHands** | Agent Canvas conversations; Critic idea (→ our auto-review) | Local-first desktop; showcase; run system depth (PTY, jobs, app runner) | Cloud sandbox default (we use local + optional Docker); git-synced automations (v2+) |
| **Cline** | Plan/Act modes; checkpoints; auto-approve categories (→ scope memory) | Approval UX with "what will happen" previews; verified completion ceremony; no VS Code dependency | Browser-use extension; marketplace at launch |
| **Replit Agent** | Run button → preview; publish gating with secrets checks | Local workspaces and repos; multi-agent; gallery; plugin platform; works with any model | Cloud IDE editor; deployments infra (we publish static previews only in v2); mobile |
| **Devin** | Playbooks (→ Tasks); multiple Devins (→ AgentsTab) | Real-time verification UX; local execution; transparent per-turn cost | Autonomous-only mode (we keep a human in the loop by default); enterprise SLAs |

**Positioning statement**: *Mesa is the harness for people who want to see, verify, and keep what their agents build — in one window, on their own machine, with any model.*

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Preview security** (malicious generated app exfiltrates data or attacks the host via the iframe) | High | High | `sandbox` attribute without `allow-top-navigation`; CSP per preview; storage partition per workspace; no host bridges exposed to iframe except a token-scoped CDP capture; network allow-list per workspace; "untrusted" banner for apps with `<script src>` to non-allow-listed origins. |
| **Token cost of UI context** (tool results, diffs, screenshots balloon the context window) | High | Medium | Tool results are *summarised* into the model context (first/last N lines + byte count) while the UI shows the full result from the ledger; screenshots downscaled to ≤ 1 024 px and sent only on explicit "send to agent"; token meter turns amber at 80 % with a "Compact" action. |
| **Plugin instability** (a bad client plugin crashes the shell) | Medium | High | Error boundary per slot (`<SlotBoundary>` resets to a fallback component); host plugins run in an isolated module with capability bag; per-plugin kill switch in PluginManager; `engines` version check; crash counter auto-disables after 3 crashes in 60 s. |
| **Streaming performance** (React re-render per token, long threads) | Medium | High | No React state per token — direct DOM append inside the streaming node; virtualised thread; xterm write batching; performance budgets in CI (Lighthouse + custom "5 000-turn scroll" test). |
| **Approval fatigue** (users click through and stop reading) | High | Medium | Presets that make most actions silent inside the workspace; scope memory ("always allow for this repo") with a visible audit list; approvals batched when ≤ 3 pending; takeover only when something *outside* the preset is requested; red-highlighted tokens only for genuinely dangerous patterns. |
| **Agent may be wrong** | Certain | High | Verify-one-click on every deliverable; verification badges (tests/preview/diff) on cards; "verified" ceremony only when green; test runner + preview are first-class, not afterthoughts. |
| **Scope creep** (feature-checklist feel) | High | Medium | Roadmap cuts per phase; every feature must name its off-switch and verify link; one design language with two accent hues only. |
| **Cross-platform PTY/sandbox differences** (Windows ACL sandbox, Seatbelt, landlock) | Medium | Medium | Reuse a proven sandbox layer (DSH-style per-OS backends); fall back to container sandbox when OS sandbox unavailable; show the active backend in Settings → Permissions. |
| **Secret leakage in exports/shared artifacts** | Medium | High | Secret handles in OS keychain; masking regex set + entropy scan at export and publish; redaction markers preserved in JSONL; preflight blocks publish on findings. |
| **Gallery storage growth** | Medium | Low | Content-addressed blobs dedupe; "Prune un-pinned artifacts older than N days" setting (default 90); size shown per session. |
