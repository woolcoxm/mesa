# Mesa — Technical Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron 30+** (main = Node 20 host) with the Web build served by the same host | PTYs (`node-pty`), native dialogs, tray, deep links; Tauri deferred to v2 (PTY + sidecar friction). Inspired by DSH Desktop. |
| UI | **React 19 + TypeScript 5.6**, Vite, CSS variables for tokens (no CSS-in-JS runtime) | Slot registry needs dynamic component loading; CSS vars let plugins theme safely. |
| Code / terminal | Monaco Editor (diff), xterm.js 5 | |
| State | **Event-sourced ledger** → projections via a reducer per pane; `useSyncExternalStore` | One source of truth; replay = timeline; export = raw log. Inspired by DSH session log. |
| Transport | **WebSocket JSON-RPC 2.0** with resumable streams (`Last-Event-Id` style cursor: `sinceSeq`); HTTP for blobs | Reconnect mid-stream without duplication. |
| Process model | Host plugin spawns processes: PTY (`node-pty`), background jobs (`child_process` + job table), sandbox via Docker/Podman sidecar; each process tagged `{sessionId, runId, owner: 'user'|'agent'}` | |
| Preview isolation | iframe + CSP + per-workspace storage partition; dev server proxied through host on `*.preview.localhost` | |
| Artifact storage | content-addressed blobs (`sha256`) in `<userData>/blobs/ab/cd…`, index in **SQLite** (`artifacts`, `artifact_versions`, `pins`, `tags`), FTS5 for `sessions` and `artifacts` text | Dedup, versioning, search. |
| Plugin loading | Host: Cordis-style YAML manifest → Node module; Client: module table served by host, `registerSlot()` into a SlotRegistry; sandboxed by convention (no FS access from client plugins) | Inspired by DSH Cordis presets. |
| Search | SQLite FTS5 over `events.payload` (markdown-stripped) | |

## Event-sourced ledger

```
events(session_id, seq INTEGER PRIMARY KEY AUTOINCREMENT, ts, type, payload JSON, step_id?, turn_id?)
```

Event types (append-only): `turn.started`, `turn.ended`, `step.started`, `step.ended`, `message.delta`, `tool.call`, `tool.result`, `approval.requested`, `approval.decided`, `artifact.created`, `run.started`, `run.output`, `run.ended`, `preview.opened`, `checkpoint.created`, `checkpoint.restored`, `present.deliverables`, `agent.spawned`, `agent.ended`, `goal.set`, `goal.progress`, `session.meta`.

Projections: `ThreadProjection`, `ArtifactsProjection`, `RunsProjection`, `StatsProjection`, `AgentsProjection`, `TimelineProjection`. Each is `(state, event) => state`; the UI subscribes to `(sessionId, projectionName)`. Rebuild = replay from `seq 0` (sessions < 50k events replay in < 300 ms; beyond that, snapshot at `seq N`).

## Performance budgets

| Concern | Budget |
|---|---|
| Token append → paint | < 16 ms (no per-token state in React; direct DOM append inside the streaming node) |
| Thread with 5 000 turns | virtualised; only ±10 turns mounted |
| Terminal output | xterm.js with `write` batching every 16 ms; 10k scrollback |
| Showcase enter | 60 fps (transform/opacity only) |
| Memory per session | < 150 MB client-side (blobs never loaded into JS unless rendered) |
| Cold start to composer focused | < 1.2 s desktop |

## Sequence: ask → stream → tool → approval → run → artifact → showcase → preview → publish

```
User          Client(UI)         Host            Agent(LLM)       Sandbox      Browser(Preview)
 │ Ctrl+Enter   │                  │                 │                │             │
 ├─────────────►│ turn.start RPC   │                 │                │             │
 │              ├─────────────────►│ ledger:turn.started              │             │
 │              │                  ├─prompt──────────►│                │             │
 │              │◄─stream deltas───┤◄─message.delta───┤                │             │
 │              │ tool.call(edit)  │                 ├─tool_call─────►│             │
 │              │◄─────────────────┤◄─────────────────┤                │             │
 │              │ tool.call(bash pnpm dev)           │                │             │
 │              │◄─approval.requested (preset asks)──┤                │             │
 │ Alt+A        │                  │                 │                │             │
 ├─────────────►│ approval.decide  │                 │                │             │
 │              ├─────────────────►│ ledger:approval.decided         │             │
 │              │                  ├─spawn(ptm)────────────────────────►│            │
 │              │◄─run.output──────┤◄──────────────────────────────────┤            │
 │              │ run.started(job) │                 │                │             │
 │              │◄─────────────────┤ tool.result(port 5173)           │             │
 │              │                  │◄────────────────┤                │             │
 │              │ present([app])   │                 │                │             │
 │              │◄─────────────────┤◄────────────────┤                │             │
 │              │                  │ ledger:present.deliverables     │             │
 │              │ ShowcaseWindow   │                 │                │             │
 │              │ (slide-in 360ms) │                 │                │             │
 │ [Run app]    │                  │                 │                │             │
 ├─────────────►│ preview.open(run)│                 │                │             │
 │              ├─────────────────►│ proxy 5173 → *.preview.localhost │             │
 │              │ iframe src ─────────────────────────────────────────────────────►│
 │              │◄─CDP console/network events──────────────────────────────────────┤
 │ [Publish]    │                  │                 │                │             │
 ├─────────────►│ publish.preflight│                 │                │             │
 │              │◄─issues[]────────┤                 │                │             │
 │              │ publish.run ────►│ build in sandbox, deploy, return link        │
```

## Data model (TypeScript)

```ts
// ids
type Id = string; // ulid

export interface Session {
  id: Id;
  workspaceId: Id;
  title: string;
  model: ModelRef;
  mode: 'plan' | 'build' | 'auto';
  permissionPreset: 'read-only' | 'workspace-write' | 'full-access';
  createdAt: string; updatedAt: string;
  parentId?: Id;            // subagent sessions
  automationId?: Id;        // created by an automation
  tags: string[];
}

export interface ModelRef { provider: string; model: string; reasoningEffort?: 'low'|'medium'|'high'; }

export type Event =
  | { seq: number; ts: string; type: 'turn.started'; turnId: Id; payload: { source: 'user'|'agent'|'automation' } }
  | { seq: number; ts: string; type: 'turn.ended'; turnId: Id; payload: { reason: 'done'|'cancelled'|'error'; usage?: Usage } }
  | { seq: number; ts: string; type: 'tool.call'; turnId: Id; stepId: Id; payload: ToolCall }
  | { seq: number; ts: string; type: 'tool.result'; turnId: Id; stepId: Id; payload: { callId: Id; ok: boolean; summary: string; artifactIds?: Id[]; runId?: Id } }
  | { seq: number; ts: string; type: 'approval.requested'; payload: Approval }
  | { seq: number; ts: string; type: 'approval.decided'; payload: { approvalId: Id; decision: Decision } }
  | { seq: number; ts: string; type: 'artifact.created'; payload: Artifact }
  | { seq: number; ts: string; type: 'run.started'; payload: Run }
  | { seq: number; ts: string; type: 'run.output'; payload: { runId: Id; stream: 'stdout'|'stderr'; chunk: string } }
  | { seq: number; ts: string; type: 'run.ended'; payload: { runId: Id; exitCode: number|null; endedAt: string } }
  | { seq: number; ts: string; type: 'present.deliverables'; turnId: Id; payload: { artifactIds: Id[] } }
  | { seq: number; ts: string; type: 'checkpoint.created'; payload: Checkpoint }
  | { seq: number; ts: string; type: 'goal.set'; payload: Goal };

export interface Usage { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number; latencyMs: number; }

export interface ToolCall {
  id: Id; name: string; args: unknown; startedAt: string; endedAt?: string;
  approvalId?: Id; status: 'queued'|'running'|'awaiting-approval'|'success'|'error'|'denied';
}

export type ArtifactKind =
  | 'code' | 'diff' | 'notebook' | 'html' | 'app' | 'image' | 'chart' | 'table'
  | 'markdown' | 'pdf' | 'pptx' | 'xlsx' | 'test-report' | 'cli-output' | 'video' | 'audio' | '3d' | 'canvas';

export interface Artifact {
  id: Id; sessionId: Id; turnId: Id; kind: ArtifactKind;
  path: string;                 // workspace-relative, or virtual e.g. "canvas:revenue"
  sha256: string; bytes: number;
  version: number;              // increments per path
  parentSha256?: string;        // previous version → enables compare
  meta?: { lines?: number; added?: number; removed?: number; framework?: string; inputs?: Record<string, unknown> };
  createdAt: string;
}

export interface Run {
  id: Id; sessionId: Id; owner: 'user'|'agent';
  runtime: 'host'|'sandbox'|'remote'|'kernel'|'node-bundled'|'static';
  command: string; cwd: string; env?: Record<string, string>;
  preset: Session['permissionPreset'];
  pid?: number; ptyId?: Id;
  status: 'starting'|'running'|'exited'|'killed'|'failed';
  startedAt: string; endedAt?: string; exitCode?: number;
  port?: number;               // detected dev server port
  previewId?: Id;
}

export interface Preview {
  id: Id; sessionId: Id; runId?: Id; artifactId?: Id;
  url: string;                 // proxied *.preview.localhost URL
  device?: { width: number; height: number; scale: number };
  partition: string;           // storage partition key
  consoleLog: ConsoleEntry[]; networkLog: NetworkEntry[];
}

export interface Approval {
  id: Id; sessionId: Id; callId: Id; kind: 'shell'|'write'|'network'|'install'|'publish';
  title: string;               // "Run shell command"
  detail: string;              // command text or diff
  risk?: { level: 'low'|'medium'|'high'; rationale: string }; // from auto-review
  requestedAt: string;
}

export type Decision =
  | { action: 'allow-once' }
  | { action: 'allow-session' }
  | { action: 'allow-always'; scope: { repo: string; match: string } }
  | { action: 'deny'; reason?: string };

export interface AgentNode {
  id: Id; sessionId: Id; parentId: Id | null; name: string; role?: string;
  status: 'running'|'idle'|'blocked'|'done'|'failed'|'paused';
  forkedFromSeq?: number;      // for fork-from-point
  usage: Usage; budgetUsd?: number; startedAt: string; endedAt?: string;
}

export interface Goal { id: Id; sessionId: Id; text: string; progress: { done: number; total: number }; status: 'active'|'paused'|'complete'|'blocked'; rounds: number; }

export interface Checkpoint { id: Id; sessionId: Id; seq: number; reason: 'auto'|'manual'; label?: string; treeHash: string; }

export interface Automation {
  id: Id; workspaceId: Id; name: string;
  trigger: { kind: 'rrule'; rrule: string; tz: string } | { kind: 'webhook'; secretRef: string };
  task: { kind: 'prompt'; prompt: string; params: ParamSpec[] } | { kind: 'run'; command: string; params: ParamSpec[] };
  targetSession: 'new' | Id;
  active: boolean; lastRunAt?: string; lastStatus?: 'ok'|'failed';
}

export interface ParamSpec { name: string; type: 'string'|'number'|'date'|'file'; default?: string; description?: string; }
```
