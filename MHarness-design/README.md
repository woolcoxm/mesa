> The implementation of this brief lives in [MHarness/app](../MHarness/app/README.md); the product README with screenshots is at the [repo root](../README.md).

# Mesa — Design Brief for a "Fancy" GUI Harness for LLM Agents

Index of the deliverables (in the order the brief requested).

| # | Deliverable | File |
|---|---|---|
| 1 | Vision & personas | [00-vision-and-personas.md](00-vision-and-personas.md) |
| 2 | IA map + wireframes | [01-ia-and-wireframes.md](01-ia-and-wireframes.md) |
| 3 | Component inventory | [02-component-inventory.md](02-component-inventory.md) |
| 4 | Showcase system spec | [03-showcase-system.md](03-showcase-system.md) |
| 5 | Run system spec | [04-run-system.md](04-run-system.md) |
| 6 | 12 interaction specs | [05-key-flows.md](05-key-flows.md) |
| 7 | Design tokens + motion + hero screens | [06-design-tokens.md](06-design-tokens.md) |
| 8 | Architecture + sequence diagram + TS data model | [07-architecture.md](07-architecture.md) |
| 9 | Plugin / slot API sketch | [08-plugin-api.md](08-plugin-api.md) |
| 10 | 12-week roadmap | [09-roadmap.md](09-roadmap.md) |
| 11 | Competitive positioning | [10-positioning-and-risks.md](10-positioning-and-risks.md) |
| 12 | Risks & mitigations | [10-positioning-and-risks.md](10-positioning-and-risks.md) |

Multi-agent & long-running work is specified across files: AgentsTab / GoalBar / PlanCard / checkpoints in [02](02-component-inventory.md), flows 7 and 10 in [05](05-key-flows.md), data model `AgentNode`/`Goal`/`Checkpoint` in [07](07-architecture.md). Trust & observability: Stats/Timeline tabs, approval UX, masking and export in [01](01-ia-and-wireframes.md), [04](04-run-system.md), [05](05-key-flows.md) (flow 12).

## Glossary

| Term | Meaning |
|---|---|
| **ACP** | Agent Client Protocol — JSON-RPC protocol letting a UI drive external agents (Claude Code, Codex, Gemini CLI). |
| **Approval takeover** | Composer is replaced by an approval UI until the user decides. |
| **Artifact** | Anything the agent produced; content-addressed and versioned. |
| **Canvas** | Agent-authored interactive view (HTML + inputs) rendered beside chat; re-runnable and shareable. |
| **Checkpoint** | Workspace + ledger snapshot that can be restored. |
| **Completion Showcase** | The floating window that presents deliverables at the end of a turn. |
| **Deliverable** | An artifact the agent declared final via `present`. |
| **Do not disturb (DND)** | Mode where showcases dock silently instead of sliding in. |
| **FLIP** | First-Last-Invert-Play animation technique used for minimise-to-tray. |
| **Goal / GoalBar** | A persisted objective spanning rounds, with a progress bar in the header. |
| **Hover peek** | Anchored preview card shown after hovering a reference for 300 ms. |
| **Inject vs Queue** | Steering modes: deliver a message at the next tool call vs after the turn ends. |
| **Ledger** | Append-only event log that is the single source of truth for a session. |
| **Preset (permission)** | Sandbox mode + approval policy bundle: read-only / workspace-write / full-access. |
| **Preview** | Live rendering of an artifact or run (iframe for web apps). |
| **Projection** | A reducer that folds ledger events into pane state. |
| **Run** | An execution with command, runtime, output and exit code. |
| **RunCard** | Inline card under a code block/tool call showing a run and its output. |
| **Scope memory** | "Always allow for this repo" rules that silence repeat approvals. |
| **Slot** | A named mount point in the UI where plugins register components. |
| **Task** | A saved, parameterised, schedulable run or prompt. |
| **Tool presentation** | Plugin registration that gives a tool a rich renderer and actions. |
| **Tray** | Bottom-left stack of minimised floating windows. |
| **Verify** | The one-click trio — diff · preview · tests — available on every deliverable. |
