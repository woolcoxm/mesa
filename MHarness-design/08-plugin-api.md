# Mesa — Plugin & Slot API

## Plugin model

A plugin = `manifest.yaml` + host entry (Node, optional) + client entry (browser module, optional).

```yaml
id: mesadev.test-runner
name: Test Runner
version: 1.2.0
engines: mesa: ">=0.3"
host:
  entry: ./dist/host.js
  tools:
    - name: test_run
      description: Run the detected test suite
      schema: ./schemas/test_run.json
  services:
    - id: test-runner
      provides: [detect, run, parse]
client:
  entry: ./dist/client.js
  slots:
    - slot: dock.tab
      id: tests
      title: Tests
      icon: test-tube
  artifactRenderers:
    - kind: test-report
  theme:
    variables: { --mesa-tests-pass: "#37C981" }
  settings:
    - key: testRunner.timeoutMs
      type: number
      default: 120000
```

Loading: host reads YAML, requires `host.entry` in a `vm`-isolated module with an explicit capability bag (`fs` scoped to workspace, `spawn` via the job table, `ledger.append`). Client modules are served from `<host>/plugins/<id>/client.js` as ES modules; they receive `mesa` (the API below) and nothing else from the page. Plugins cannot access `document` outside their own slots by convention; a lint rule in the SDK enforces it.

## Named slots (18)

| Slot id | Props | Rendered by |
|---|---|---|
| `shell.root` | `{}` | AppShell (single) |
| `shell.rail` | `{ workspace, collapsed }` | RailNav |
| `shell.rail.session` | `{ session, active }` | SessionRow decorations (badges, actions) |
| `shell.rail.page` | `{ id, title, icon }` | Pages: gallery, automations, plugins, settings |
| `shell.dock` | `{}` | DockPanel host (single) |
| `dock.tab` | `{ id, title, icon, sessionId, order, floatable }` | Right dock tabs |
| `dock.tab.actions` | `{ tabId, sessionId }` | Icon buttons in a tab's header |
| `shell.overlay` | `{ layer: 'window'|'modal'|'toast'|'tray' }` | Floating windows, palettes, dialogs |
| `shell.toast` | `{}` | Toast region |
| `shell.tray` | `{}` | Minimised window stack |
| `conversation.header` | `{ session }` | Header centre |
| `conversation.header.right` | `{ session, usage }` | Token meter, job chip |
| `conversation.header.goal` | `{ goal }` | GoalBar |
| `conversation.turn` | `{ turn, events }` | TurnCard |
| `conversation.turn.steps` | `{ steps }` | StepTree |
| `conversation.tool` | keyed by tool name: `{ call, result }` | Per-tool renderers (bash, edit, read, image, skill, workflow…) |
| `conversation.composer` | `{ session, mode }` | Composer (single) |
| `conversation.composer.above` | `{ session }` | PlanCard |
| `conversation.composer.below` | `{ session, queued }` | QueuedMessages |
| `conversation.composer.takeover` | `{ approval }` | ApprovalTakeover (single at a time) |
| `conversation.composer.dock` | `{ attach, insertRef }` | Composer buttons: attach, @file, /cmd, voice |
| `showcase.card` | `{ card: DeliverableCard }` | DeliverableCard per kind (falls back to default) |
| `showcase.card.actions` | `{ card }` | Extra action buttons |
| `artifact.canvas` | `{ artifact }` | CanvasView |
| `artifact.notebook` | `{ artifact }` | NotebookView |
| `run.terminal` | `{ run }` | TerminalView |
| `run.jobs` | `{ jobs }` | JobPanel |
| `run.tests` | `{ report }` | TestRunnerView |
| `files.diff` | `{ before, after }` | DiffViewer |

## Services available to client plugins

`mesa.theme` (read tokens, `onChange`), `mesa.locale` (`t(key)`, `onChange`), `mesa.keys` (`bind(spec, fn)`, `unbind`), `mesa.commands` (`register({id, title, shortcut, run})`), `mesa.rpc` (`call(method, params)`, `subscribe(sessionId, projection)`), `mesa.toast(info)`, `mesa.navigate({ tab, sessionId, artifactId })`, `mesa.composer.insert(text | ref)`.

## TypeScript interfaces

```ts
export interface MesaClientApi {
  registerSlot<T>(reg: SlotRegistration<T>): () => void;
  registerToolPresentation(reg: ToolPresentation): () => void;
  registerArtifactRenderer(reg: ArtifactRenderer): () => void;
  registerCommand(cmd: Command): () => void;
  theme: ThemeService; locale: LocaleService; keys: KeyService;
  rpc: RpcService; toast(toast: ToastInput): void;
  navigate(target: NavigationTarget): void;
  composer: { insert(content: string | ComposerRef): void; send(): void };
  events: { on<T>(type: string, fn: (e: T) => void): () => void };
}

export interface SlotRegistration<T> {
  slot: SlotId;
  id?: string;                 // stable id for ordering/removal
  order?: number;
  component: ComponentType<SlotProps<T>>;
  when?: (props: SlotProps<T>) => boolean;   // conditional display
}

export interface ToolPresentation {
  tool: string;                                   // tool name, e.g. "bash"
  title?: (call: ToolCall) => string;             // one-line title
  component: ComponentType<{ call: ToolCall; result?: ToolResult }>;
  summary?: (call: ToolCall, result?: ToolResult) => ReactNode; // collapsed one-liner
  actions?: Array<{ id: string; label: string; icon?: string; run: (ctx: ToolContext) => void }>;
  /** Whether the result should be streamed into the row (e.g. long stdout). */
  stream?: boolean;
}

export interface ArtifactRenderer {
  kind: ArtifactKind | string;                    // custom kinds allowed with a prefix
  match?: (a: Artifact) => boolean;               // refine by path/meta
  component: ComponentType<{ artifact: Artifact; mode: 'thumb' | 'full' }>;
  thumbnail?: (artifact: Artifact, api: MesaClientApi) => Promise<Thumb | null>;
  actions: Array<{ id: string; label: string; available: (a: Artifact) => boolean; run: (a: Artifact, api: MesaClientApi) => void }>;
}

export interface SlotProps<T> { sessionId: string; api: MesaClientApi } & T;
export type SlotId = 'shell.root' | 'shell.rail' | 'shell.rail.session' | 'shell.rail.page' | 'shell.dock'
  | 'dock.tab' | 'dock.tab.actions' | 'shell.overlay' | 'shell.toast' | 'shell.tray'
  | 'conversation.header' | 'conversation.header.right' | 'conversation.header.goal' | 'conversation.turn'
  | 'conversation.turn.steps' | 'conversation.tool' | 'conversation.composer' | 'conversation.composer.above'
  | 'conversation.composer.below' | 'conversation.composer.takeover' | 'conversation.composer.dock'
  | 'showcase.card' | 'showcase.card.actions' | 'artifact.canvas' | 'artifact.notebook'
  | 'run.terminal' | 'run.jobs' | 'run.tests' | 'files.diff';

export interface ThemeService {
  get(name: string): string;
  set(vars: Record<string, string>): void;      // scoped to the plugin's own --mesa-<plugin>-* prefix
  onChange(fn: (mode: 'light'|'dark'|'hc') => void): () => void;
  mode(): 'light'|'dark'|'hc';
}
export interface LocaleService { t(key: string, vars?: Record<string, unknown>): string; onChange(fn: () => void): () => void; locale(): string; }
export interface KeyService { bind(spec: string, fn: () => void, opts?: { when?: () => boolean }): () => void; }
export interface Command { id: string; title: string; shortcut?: string; icon?: string; run: (api: MesaClientApi) => void; }
```

## Other extension points
- **Skills**: markdown bundles (`SKILL.md` + assets) loaded per workspace or globally; can ship a canvas theme (`--canvas-*` tokens).
- **MCP servers**: configured in Settings → MCP; tools appear with a generic renderer unless a plugin registers a presentation.
- **Hooks**: `beforeToolCall`, `afterToolCall`, `turnEnd`, `approvalRequested` — host-side scripts compatible with Claude Code / Codex hook shapes (inspired by DSH hook bridges).
- **Slash commands**: `/name` → prompt template with `$ARGUMENTS`; custom commands in `.mesa/commands/*.md`.
- **Agent presets / compositions editor**: a YAML/JSON preset (model, effort, system prompt, tools allow-list, permission preset, subagent definitions) edited in a form UI with a live preview of the composed prompt.
- **ACP**: an `acp` host plugin exposes any ACP-compatible agent (Claude Code, Codex, Gemini CLI) as a Session backend; the UI is identical because it consumes the same ledger events (`tool.call`/`tool.result` mapped from ACP `session/update`).
