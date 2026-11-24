# Mesa — Design Tokens, Motion, Hero Screens

## Direction: **"Glass + precision"** — *"Mission control, but warm."*
Frosted layers over a deep, quiet canvas; one saturated accent reserved for *the agent is acting*; a second success hue reserved for *verified*. Typography is a geometric sans for UI and a mono for anything the agent produced. Inspired by: DSH `--dsw-*` tokens, Linear's density modes, Raycast's palette motion.

## Colour tokens

| Token | Light | Dark | High-contrast dark | Use |
|---|---|---|---|---|
| `--mesa-bg-canvas` | `#F4F5F7` | `#0F1115` | `#000` | app background |
| `--mesa-bg-surface` | `#FFFFFF` | `#161A21` | `#0A0A0A` | panes |
| `--mesa-bg-elevated` | `#FFFFFFCC` | `#1C212ACC` | `#111` | floating windows (glass: backdrop-blur 16 px) |
| `--mesa-bg-sunken` | `#ECEEF2` | `#0B0D11` | `#000` | terminal, code blocks |
| `--mesa-border-subtle` | `#E3E6EB` | `#232933` | `#333` | dividers |
| `--mesa-border-strong` | `#C9CED6` | `#3A4250` | `#767676` | focus rings |
| `--mesa-text-primary` | `#15181D` | `#E8EBEF` | `#FFF` | |
| `--mesa-text-secondary` | `#5B6472` | `#9AA4B2` | `#C8C8C8` | |
| `--mesa-text-muted` | `#8A93A1` | `#6B7684` | `#9A9A9A` | |
| `--mesa-accent` (agent acting) | `#4F5BD9` | `#7C86FF` | `#9AA4FF` | streaming cursor, running dots, primary buttons |
| `--mesa-success` (verified) | `#1F9D63` | `#37C981` | `#5BE39D` | tests pass, exit 0, verified badge |
| `--mesa-warning` | `#D98A0B` | `#F0A62A` | `#FFC15A` | full-access pill, warnings |
| `--mesa-danger` | `#D64545` | `#FF6B6B` | `#FF8A8A` | failures, dangerous tokens |
| `--mesa-info` | `#2A8BD6` | `#4FB3FF` | `#7FCCFF` | links, plan mode |
| `--mesa-diff-add` | `#DFF5E9` / `#147A47` | `#12321F` / `#37C981` | `#0F3D22` / `#6BF0A8` | bg / text |
| `--mesa-diff-del` | `#FBE3E3` / `#B83232` | `#3A1818` / `#FF7B7B` | `#3F0F0F` / `#FF9E9E` | bg / text |

Contrast: all text pairs meet WCAG 2.2 AA (≥ 4.5:1); high-contrast theme targets AAA (≥ 7:1).

## Type scale (rem, base 16 px)

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--mesa-type-display` | 1.5 / 2 rem | 600 | Showcase title |
| `--mesa-type-h2` | 1.125 / 1.5 rem | 600 | section headers |
| `--mesa-type-body` | 0.9375 / 1.5 rem | 400 | chat text |
| `--mesa-type-ui` | 0.8125 / 1.25 rem | 500 | buttons, tabs |
| `--mesa-type-caption` | 0.75 / 1 rem | 500 | meta, chips |
| `--mesa-type-mono` | 0.8125 / 1.5 rem | 400 | code, terminal (font: "JetBrains Mono", fallback "Cascadia Code", "SF Mono", monospace) |
| `--mesa-type-sans` | — | — | "Inter Variable", fallback "Segoe UI Variable", system-ui |

## Spacing, radius, elevation, density

- Spacing: 4 px base — `2, 4, 8, 12, 16, 24, 32, 48, 64`.
- Radius: `--mesa-r-sm 4px` (chips), `--mesa-r-md 8px` (inputs, cards), `--mesa-r-lg 12px` (windows), `--mesa-r-full 999px` (pills, avatars).
- Elevation: `e1` = `0 1px 2px #0002`; `e2` = `0 8px 24px #0003, 0 2px 6px #0002`; `e3` (windows) = `0 24px 64px #0005, 0 4px 12px #0003` + backdrop-blur 16 px.
- Density modes: **Comfortable** (row 36 px, chat 1.5), **Compact** (row 28 px, chat 1.4), **Density: terminal** (row 24 px, chat 1.35). Switch: `Ctrl+Alt+,` or Settings → Appearance.
- Iconography: 20 px outline, 1.5 px stroke, rounded caps (Lucide-compatible set, custom glyph for the Mesa mark).

## Motion tokens

| Token | Value | Used for |
|---|---|---|
| `--mesa-m-instant` | 80 ms | hover, pressed |
| `--mesa-m-fast` | 120–160 ms | peek, popover, toast |
| `--mesa-m-base` | 200–240 ms | tab switch, pane dock |
| `--mesa-m-slow` | 320–360 ms | window slide-in |
| `--mesa-e-out` | `cubic-bezier(.2,.9,.25,1)` | entrances |
| `--mesa-e-in` | `cubic-bezier(.4,0,1,1)` | exits |
| `--mesa-e-spring` | `cubic-bezier(.34,1.56,.64,1)` | FLIP minimises, pill toggles |
| `--mesa-stagger` | 60 ms | card / hunk stagger |
| `--mesa-stream-cursor` | 1 s steps(2) blink | streaming caret |
| `--mesa-pulse` | 1.6 s ease-in-out infinite | running dots, kernel busy |

Rules: only `transform` and `opacity` are animated (GPU-friendly); `prefers-reduced-motion` sets all durations to 0 and disables stagger/sweep/pulse; every entrance is interruptible by pointer-down; streaming text appends without layout animation (no fade-in per token — keeps 60 fps and avoids flicker).

## Streaming readability

- Markdown renders progressively; an unclosed code fence renders as code immediately with a "streaming" left border in `--mesa-accent`.
- Tables render row-by-row with fixed column widths computed from the header to avoid reflow.
- "Thinking" state: a 3-dot pulse + the model's reasoning summary (collapsible, 2 lines max) above the answer.
- Skeletons: tool-call rows show a 20 px shimmer bar until the first result byte; never skeleton text.
- Scroll anchoring: pinned to bottom while streaming; unpinned when user scrolls > 200 px; "↓ 12 new" pill.

## Three hero screens

**Light — "Monday morning review."** Canvas `#F4F5F7`, panes white with 1 px `#E3E6EB` borders. Center thread: a finished turn with three tool rows collapsed to one-liners, `read`, `edit [+42 −7]`, `bash ✓ 1.2s` in mono caption. Right dock open on **Files & diffs** in split view; additions in mint `#DFF5E9`, deletions in rose `#FBE3E3`. Header mode pill "Workspace write" in blue; token meter a thin 2 px arc at 41 %. Showcase window floats at the right edge over the dock with 16 px blur and `e3` shadow; the first hero card shows a mini Monaco thumbnail. The accent is used exactly twice on screen: the streaming cursor is gone (idle), and the *Verify all* button. Everything else is neutral — the work is the colour.

**Dark — "Night build."** Canvas `#0F1115`, panes `#161A21`, terminal sunken to `#0B0D11` with JetBrains Mono. A dev server runs: header chip `⚡ 1` pulses in accent; Preview tab shows a Vite app at 390 × 844 device size; Console tab has 2 entries in `--mesa-warning`. Agents tab is floated to the left of the dock as a glass panel with 3 child nodes, two green (done), one pulsing accent (running), cost roll-up `$0.42`. The showcase for the previous turn is minimised to the tray; a 4 s accent glow is fading on the header. Success green appears only on the two passed-test rows and the exit-0 badge.

**Showcase moment — "Done, and verified."** User presses nothing; the agent calls `present` with 3 deliverables. The thread dims 4 %, a window slides in from the right (360 ms), cards stagger 60 ms: `src/app.ts` (thumbnail of highlighted code, `+42 −7`, `✓ tests pass (12)`), `revenue.canvas` (rendered chart thumbnail with a "re-run ▸" chip), `app` (framework badge "Vite", `[Run app]`). Because all verifications are green, a 1 px accent line sweeps under the header in 900 ms and the header glows once. The *Verify all* row reads: `diff · preview · tests` — three words, three clicks. With Do-not-disturb on, none of this happens; instead a `✦ 3 deliverables` chip appears in the header and the Gallery badge increments.

## Accessibility

- WCAG 2.2 AA: focus visible (2 px `--mesa-border-strong` + 2 px offset), target size ≥ 24 px, no drag-only actions (every drag handle has a keyboard equivalent via `Ctrl+Alt+←/→`).
- Live regions: thread uses `role="log" aria-live="polite"` for *completed* turns only; streaming text is `aria-busy="true"` and silent until the turn ends (then the final answer is announced). Showcase windows are `role="status"`; approval takeover moves focus to the Allow button and traps it.
- Every dynamic region has an `aria-label` set by its component (`TerminalView` → "Terminal: pnpm dev, running").
- Colour is never the only signal (icons + text for state).

## Desktop niceties

Native file dialogs (Electron `dialog`), drag/drop files onto composer and Gallery, `mesa://session/<id>` deep links, system tray with running-jobs count, OS notifications for finished jobs and approvals (when unfocused), touch layout: rail becomes a bottom bar, dock becomes a swipe-in sheet at < 900 px width.
