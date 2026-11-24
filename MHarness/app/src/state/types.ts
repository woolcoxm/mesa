export type Id = string;

export type ToolStatus = 'queued' | 'running' | 'awaiting-approval' | 'success' | 'error' | 'denied';
export type ArtifactKind =
  | 'code' | 'diff' | 'notebook' | 'html' | 'app' | 'image' | 'chart' | 'table'
  | 'markdown' | 'pdf' | 'test-report' | 'cli-output' | 'canvas';
export type Runtime = 'host' | 'sandbox' | 'remote' | 'kernel' | 'node-bundled' | 'static';
export type Preset = 'read-only' | 'workspace-write' | 'full-access';
export type Mode = 'plan' | 'build' | 'auto';

export interface Hunk { oldStart: number; oldLines: string[]; newStart: number; newLines: string[] }
export interface DiffInfo { file: string; added: number; removed: number; hunks: Hunk[] }

export interface Approval {
  id: Id;
  callId: Id;
  kind: 'shell' | 'write' | 'network' | 'install' | 'publish';
  title: string;
  detail: string;
  flags: string[];
  risk?: { level: 'low' | 'medium' | 'high'; rationale: string };
  requestedAt: number;
}
export type Decision =
  | { action: 'allow-once' }
  | { action: 'allow-session' }
  | { action: 'allow-always' }
  | { action: 'deny'; reason?: string };

export interface ToolCall {
  id: Id;
  name: string;
  title: string;
  subtitle?: string;
  status: ToolStatus;
  startedAt: number;
  endedAt?: number;
  ms?: number;
  output?: string;
  diff?: DiffInfo;
  runtime?: Runtime;
  preset?: Preset;
  approval?: Approval;
  decision?: Decision;
  artifactIds?: string[];
  runId?: Id;
  stream?: boolean;
  error?: string;
}

export type Block =
  | { id: Id; type: 'text'; text: string; streaming: boolean }
  | { id: Id; type: 'tool'; call: ToolCall };

export interface Usage { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number; latencyMs: number; costEstimated?: boolean }

export interface Artifact {
  id: Id;
  sessionId: Id;
  turnId: Id;
  kind: ArtifactKind;
  title: string;
  path: string;
  createdAt: number;
  bytes?: number;
  lines?: number;
  added?: number;
  removed?: number;
  code?: string;
  html?: string;
  chart?: ChartSpec;
  notebook?: NotebookSpec;
  framework?: string;
  inputs?: Record<string, unknown>;
  verification?: { tests?: 'pass' | 'fail' | 'unknown'; preview?: 'ready' | 'error' | 'none'; diff?: boolean };
  pinned?: boolean;
  version?: number;
  tags?: string[];
}

export interface NotebookSpec { kernel?: string; language?: string; cells: { kind: 'code' | 'markdown'; source: string; execution_count?: number; outputs?: { type: 'text' | 'html' | 'image' | 'error'; value: string }[] }[] }
export interface ChartSpec { title: string; labels: string[]; values: number[]; series?: string; color?: string }

export interface Run {
  id: Id;
  sessionId: Id;
  owner: 'user' | 'agent';
  runtime: Runtime;
  command: string;
  cwd: string;
  preset: Preset;
  status: 'starting' | 'running' | 'exited' | 'killed' | 'failed';
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
  port?: number;
  lines: string[];
  background: boolean;
  artifactId?: Id;
  notify?: boolean;
  selected?: boolean;
}

export interface Turn {
  id: Id;
  user: string;
  status: 'running' | 'awaiting' | 'done' | 'error' | 'cancelled';
  startedAt: number;
  endedAt?: number;
  blocks: Block[];
  thinking?: string;
  deliverables: Id[];
  usage: Usage;
}

export interface Goal { text: string; done: number; total: number; status: 'active' | 'paused' | 'complete' | 'blocked'; rounds: number }
export interface Plan { items: { text: string; state: 'todo' | 'doing' | 'done' }[]; reviewed: boolean }
export interface AgentNode { id: Id; name: string; role: string; status: 'running' | 'idle' | 'done' | 'failed' | 'blocked' | 'paused'; cost: number; startedAt: number; endedAt?: number; note?: string }
export interface TLEvent { id: Id; ts: number; label: string; kind: 'turn' | 'tool' | 'run' | 'approval' | 'artifact' | 'checkpoint' | 'present'; ms?: number; callId?: Id }
export interface Checkpoint { id: Id; seq: number; label: string; at: number; auto: boolean }
export interface QueuedMsg { id: Id; text: string; mode: 'queue' | 'inject' }

export interface Session {
  id: Id;
  title: string;
  workspace: string;
  group: 'Today' | 'Yesterday' | 'This week' | 'Project: mesa';
  state: 'idle' | 'running' | 'awaiting' | 'error';
  model: string;
  mode: Mode;
  preset: Preset;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
  artifacts: Artifact[];
  runs: Run[];
  tokens: number;
  contextMax: number;
  cost: number;
  cacheHit: number;
  goal?: Goal;
  plan?: Plan;
  agents: AgentNode[];
  timeline: TLEvent[];
  checkpoints: Checkpoint[];
  selectedRunId?: Id;
  activeTab?: DockTab;
  hasDeliverables: boolean;
  allowSessionShell?: boolean;
  queued: QueuedMsg[];
  pendingApproval?: Approval;
  cancel?: () => void;
}

export type DockTab = 'artifacts' | 'run' | 'preview' | 'files' | 'agents' | 'stats' | 'timeline' | 'browser';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Toast { id: Id; text: string; kind: 'info' | 'success' | 'warning' | 'error'; at: number; icon?: string; action?: { label: string; run: () => void }; ttlMs?: number }
export interface TrayItem { id: Id; title: string; subtitle: string; sessionId: string; turnId: string; kind: 'showcase' }
export interface Settings {
  theme: ThemeMode;
  density: 'comfortable' | 'compact' | 'terminal';
  dnd: boolean;
  effects: boolean;
  notifications: boolean;
  autoComplete: boolean;
  sidebarWidth: number;
  dockWidth: number;
  agent: 'demo' | 'live';
  shell: boolean;
  accent: string;
  tourDone: boolean;
  shortcuts: Record<string, string>;
  provider?: { baseUrl: string; apiKey: string; model: string; preset: string; proxy: boolean; tools?: boolean };
}

export interface AppState {
  sessions: Session[];
  activeSessionId: Id;
  dock: { open: boolean; tab: DockTab; floating: boolean };
  rail: { open: boolean; search: string; collapsed: Record<string, boolean> };
  palette: { open: boolean; query: string };
  gallery: { open: boolean; kind: string; query: string; selected?: Id; compareWith?: Id };
  showcase: { sessionId: Id; turnId: Id; minimized: boolean; entering: boolean } | null;
  page: 'session' | 'settings' | 'plugins' | 'automations';
  toasts: Toast[];
  tray: TrayItem[];
  settings: Settings;
  canvasSplit: number | null; // % width of the canvas pane when open (null = closed)
  canvasArtifact: { sessionId: Id; artifactId: Id } | null;
  insert: { text: string; n: number } | null;
  confetti: { n: number; x: number; y: number } | null;
  adhoc: { title: string; html: string } | null;
  focus: { callId: Id; n: number } | null;
  tour: number | null;
  publish: { sessionId: Id; artifactId: Id } | null;
  cheat: boolean;
}
