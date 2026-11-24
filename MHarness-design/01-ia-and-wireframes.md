# Mesa — Information Architecture & Wireframes

## Core UI objects

| Object | Definition | Key relations |
|---|---|---|
| **Session** | One conversation + its ledger + its workspace binding. Has a permission preset, model, and mode. | has many Turns, owns Runs, Previews, Terminals, Agents, Checkpoints |
| **Turn** | One user message → agent work → final answer. Atomic unit for cost/stat rows. | has Steps, may end with Deliverables |
| **Step** | One model call inside a turn (reasoning + tool calls). | has ToolCalls |
| **ToolCall** | One tool invocation with args, result, timing, approval link. | may produce Artifacts, Runs, Approvals |
| **Artifact** | Anything produced: file, image, chart, doc, app, test report, canvas. Content-addressed (`sha256`), versioned. | belongs to Session, may be pinned to Gallery |
| **Run** | An execution: command, runtime, pid, stdout/stderr, exit code, media. | launched by ToolCall or user; may serve a Preview |
| **Preview** | Live rendering of an Artifact or Run (iframe for web, kernel for notebooks, renderer for docs). | bound to Run (dev server) or Artifact |
| **Checkpoint** | Snapshot of workspace + ledger position; restorable. | created before destructive steps or on demand |
| **Goal / Plan** | Persisted objective across rounds (GoalBar) + the agent's plan card + todo list. | spans Turns |
| **Task** | A saved, parameterised, re-runnable Run or prompt. | schedulable |
| **Approval** | A pending permission request with scope, reason, and decision. | blocks a ToolCall |
| **Agent** | Node in the subagent tree (root, child, fork). | has own Session view, cost rollup |
| **Automation** | RRULE or webhook trigger → Task in a Session. | fires Sessions |
| **Skill / Plugin** | Instruction bundle (skill) or code bundle registering tools/slots (plugin). | global or per-workspace |
| **Deliverable** | The subset of Artifacts the agent declares final via `present`. | shown in Showcase, Gallery |

## Shell

Three resizable panes + floating windows + command palette.

```
┌──────┬────────────────────────────────────────────┬───────────────────────────┐
│ Rail │  Header: session title · mode pill · model │  Right Dock (tabs)        │
│ 72px │  · goal bar · token meter · job status ⚡2  │  Artifacts Run Preview    │
│      ├────────────────────────────────────────────┤  Browser Files Agents     │
│ [WS] │  Conversation thread (virtualised)         │  Stats Timeline           │
│      │   Turn 12                                │  ┌─────────────────────┐  │
│ ▢ New│    user bubble                           │  │ tab content         │  │
│      │    Step 3 ▸ tool tree                    │  │                     │  │
│ 🔍   │      ├ read  src/app.ts                  │  │                     │  │
│      │      ├ edit  src/app.ts  [+42 −7]        │  │                     │  │
│ Sessions│    └ bash  pnpm test  ✓ 1.2s           │  │                     │  │
│ ▸ Today│  Turn 13 (streaming)                   │  │                     │  │
│   ● #14│    ▌cursor                            │  │                     │  │
│   ○ #13│  ┌──────────────────────────────────┐  │  │                     │  │
│ Agents│  │ Plan card  ▣▣▣░░ 3/5   [Review]   │  │  │                     │  │
│ Auto  │  ├──────────────────────────────────┤  │  │                     │  │
│ Plug  │  │ ⏱ approval takeover (when active)│  │  │                     │  │
│ Set   │  ├──────────────────────────────────┤  │  │                     │  │
│      │  │ queued: "also fix the types"   ↧  │  │  │                     │  │
│      │  │ @file /cmd  [Plan▾][model▾] ➤Inject│  │  │                     │  │
└──────┴───┴────────────────────────────────────┴──┴──┴─────────────────────┴──┘
          6px drag handles (hover → 2px accent line, drag → live resize, double-click → reset)
```

**Left rail (72 px collapsed, 280 px expanded)**: workspace switcher (top, `Ctrl+Shift+W`), "New session" button, session tree grouped by *Today / Yesterday / This week / Project*, each row: state dot (`●` running, `◐` awaiting approval, `○` idle, `✓` has deliverables), title, relative time, model chip on hover. Inline search box (`Ctrl+K` → "sessions:" scope). Below: **Agents** (live tree count), **Automations**, **Plugins & Skills**, **Settings**.

**Header (44 px)**: session title (editable), mode pill (`Plan` / `Build` / `Auto` — colour-coded to the active permission preset), model picker, goal bar (when a goal exists: text + progress), token meter (context fill arc), background job status chip (`⚡ 2 running` → opens Run console).

**Center**: thread (see Component inventory), composer stack (plan card → approval takeover → queued messages → composer). Thread is virtualised; scroll anchoring pins to the bottom while streaming unless the user scrolls up > 200 px (then a "↓ Jump to latest (12)" pill appears).

**Right dock**: tab strip (icons + labels; overflow into `⋯`), dock/float toggle per tab (`Ctrl+Shift+F` floats the active tab). Min width 320 px, default 40 % of window, max 70 %.

## Floating windows

| Window | Trigger | Contents | Placement | Animation | Dismissal |
|---|---|---|---|---|---|
| **Completion Showcase** | Turn ends with ≥ 1 deliverable AND user is not in a nested approval | Hero card per deliverable, Verify row, Pin/Share | Slides in from right edge, stacked under the dock if dock is open; else from right over thread | 360 ms `cubic-bezier(.2,.9,.25,1)` translateX(100 %→0) + opacity; stagger cards 60 ms | Esc, ✕, "Open" (moves to dock), auto-minimise to Gallery toast after 8 s if `Do not disturb` |
| **Hover Peek** | Hover ≥ 300 ms on a file ref / diff chip / artifact link | Rendered preview (code, image, md) in a 480×360 card | Anchored to cursor, flipped to stay in viewport | 120 ms fade + scale .98→1 | Mouse leave, Esc, scroll |
| **Quick Run** | `Ctrl+Enter` on a code block / Run button | Runtime picker + Run button + "pin to console" | Popover under the trigger | 100 ms | Click outside, Esc |
| **Approval dialog** (floating variant) | Approval requested while dock is closed or window is unfocused | Same as takeover content | Bottom-centre toast with "Expand" | 200 ms slide-up | Decision, Esc (= deny) |
| **Share / Publish** | "Share" on deliverable, "Publish" on preview | Preflight checklist, link, expiry, secret prompts | Centred modal 560 px | 200 ms fade | Cancel, Done |
| **Checkpoint restore** | Click a checkpoint in Timeline | Diff summary since checkpoint + "Restore" | Centred modal | 200 ms | Cancel / Restore |
| **Gallery** | `Ctrl+Shift+G` or rail → Gallery | Full-screen grid with filters | Full-screen overlay | 240 ms fade | Esc |

**Stacking rule**: max 3 floating windows; oldest auto-minimises to a toast in the bottom-left "Tray" stack. **Do not disturb** (`Ctrl+Shift+D` or Settings → Notifications): Showcase windows dock silently into the Gallery and show a 4 s header glow instead.

## Command palette (`Ctrl+K`)

Fuzzy list with scopes typed as prefixes: `>` actions (default), `@` files, `#` sessions, `?` settings, `/` slash commands sent to agent. Each row shows the keyboard shortcut. Global shortcut map (defaults, all editable in Settings → Keyboard):

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette |
| `Ctrl+N` | New session |
| `Ctrl+Shift+W` | Workspace switcher |
| `Ctrl+Enter` | Send / run |
| `Alt+Enter` | Queue message (send when idle) |
| `Shift+Enter` | Inject at next tool call |
| `Ctrl+.` | Toggle Plan/Build mode |
| `Ctrl+Shift+P` | Cycle permission preset |
| `Ctrl+1…8` | Right dock tabs |
| `Ctrl+Shift+F` | Float/unfloat active dock tab |
| `Ctrl+Shift+G` | Gallery |
| `Ctrl+Shift+J` | Run console |
| `Ctrl+Shift+B` | Browser tab |
| `Ctrl+\` | Toggle left rail |
| `Ctrl+Shift+\` | Toggle right dock |
| `Alt+A` | Approve (when approval visible) |
| `Alt+R` | Deny with reason |
| `Ctrl+Shift+D` | Do not disturb |
| `F2` | Rename session |
| `Ctrl+Alt+T` | New terminal tab |

## Annotated wireframe — right dock tabs

```
Artifacts & Deliverables             Run console
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ [All][Delivered][Changed][Pinned]  │   │ [bash: pnpm dev ●][vitest ✓][+]│
│ ┌─────────┐ ┌─────────┐      │   │ ┌───────────────────────────────┐
│ │ hero    │ │ hero    │      │   │ │ $ pnpm dev                    │
│ │ card    │ │ card    │      │   │ │ VITE ready in 412 ms          │
│ │ app.ts  │ │ chart   │      │   │ │ ➜ Local http://localhost:5173 │
│ │ +42 −7  │ │ .canvas │      │   │ │ [Open preview] [Kill] [Pin]   │
│ └─────────┘ └─────────┘      │   │ └───────────────────────────────┘
│ Changed files (7) ▾           │   │ Background jobs (2)  ⚡         │
│  M src/app.ts        [diff]   │   │  ▸ build  2m10s  ●            │
│  A tests/app.test.ts [diff]   │   │  ▸ watch  --    ●            │
└───────────────────────────────┘   └───────────────────────────────┘
Preview                             Files & diffs
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ ▸ http://localhost:5173  ⟳     │   │ src/            [tree|list]   │
│ [📱][💻][🖥]  [Console][Network]│   │  ▸ app/                        │
│ ┌───────────────────────────┐ │   │  ● app.ts          M  +42 −7  │
│ │                           │ │   │  ● app.test.ts     A  +120    │
│ │   sandboxed iframe        │ │   │ ───────────────────────────── │
│ │                           │ │   │ @@ -12,7 +12,9 @@   [Split|Uni]│
│ └───────────────────────────┘ │   │ - const x = 1                 │
│ [Open in browser] [📷 to chat]│   │ + const x = compute()         │
│ [Send element → agent]        │   │ [Explain this hunk]            │
└───────────────────────────────┘   └───────────────────────────────┘
```
