import type {
  AgentNode, AppState, Artifact, Approval, Block, Checkpoint, Decision, DockTab, Id, Plan, Preset, QueuedMsg,
  Run, Session, Toast, TLEvent, ToolCall, Turn, Usage,
} from './types';
import { pickScenario, SEED_PLAN, type ArtifactSeed, type SceneStep, type Scenario } from '../agent/scenarios';
import { estimateCostUsd, extractHtmlArtifacts, runShellStream, streamChat, SYSTEM_PROMPT_FENCE, SYSTEM_PROMPT_TOOLS, TOOLS, type ChatMessage, type StreamResult } from '../agent/provider';
import { acpCancel, runAcpPrompt } from '../agent/acp';

export const uid = (): Id => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const DOCK_TABS: { id: DockTab; label: string; key: string }[] = [
  { id: 'artifacts', label: 'Artifacts', key: '1' },
  { id: 'run', label: 'Run console', key: '2' },
  { id: 'preview', label: 'Preview', key: '3' },
  { id: 'files', label: 'Files & diffs', key: '4' },
  { id: 'agents', label: 'Agents', key: '5' },
  { id: 'stats', label: 'Stats', key: '6' },
  { id: 'timeline', label: 'Timeline', key: '7' },
  { id: 'browser', label: 'Browser', key: '8' },
];

const PRESET_LABEL: Record<Preset, string> = { 'read-only': 'Read-only', 'workspace-write': 'Workspace write', 'full-access': 'Full access' };
export const presetLabel = (p: Preset) => PRESET_LABEL[p];

function newSession(partial: Partial<Session> & { title: string; id?: Id }): Session {
  const now = Date.now();
  return {
    id: partial.id ?? uid(),
    workspace: 'mesa-demo',
    group: partial.group ?? 'Today',
    state: 'idle',
    model: 'mesa-1-pro',
    mode: 'build',
    preset: 'workspace-write',
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    turns: [],
    artifacts: [],
    runs: [],
    tokens: 0,
    contextMax: 200_000,
    cost: 0,
    cacheHit: 0,
    agents: [],
    timeline: [],
    checkpoints: [],
    hasDeliverables: false,
    queued: [],
    ...partial,
  };
}

const initial: AppState = {
  sessions: [],
  activeSessionId: '',
  dock: { open: true, tab: 'artifacts', floating: false },
  rail: { open: true, search: '', collapsed: {} },
  palette: { open: false, query: '' },
  gallery: { open: false, kind: 'all', query: '' },
  showcase: null,
  page: 'session',
  toasts: [],
  tray: [],
  settings: { theme: 'dark', density: 'comfortable', dnd: false, effects: true, notifications: true, autoComplete: false, sidebarWidth: 260, dockWidth: 44, agent: 'demo', shell: false, accent: 'indigo', tourDone: false, shortcuts: {} },
  canvasSplit: null,
  canvasArtifact: null,
  insert: null,
  confetti: null,
  adhoc: null,
  focus: null,
  tour: null,
  publish: null,
  cheat: false,
};

let state: AppState = initial;
const listeners = new Set<() => void>();
let version = 0;
const LS_KEY = 'mesa.state.v2';
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let serverTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    let text = '';
    try {
      const sessions = state.sessions.map((s) => ({ ...s, cancel: undefined, pendingApproval: undefined, queued: [] as QueuedMsg[] }));
      text = JSON.stringify({ sessions, settings: state.settings, activeSessionId: state.activeSessionId, savedAt: Date.now() });
      localStorage.setItem(LS_KEY, text);
    } catch { /* quota or unavailable */ }
    // Mirror to the workspace state file when the Mesa server is present (cross-browser persistence). Non-blocking, throttled.
    if (text && serverTimer) clearTimeout(serverTimer);
    if (text) serverTimer = setTimeout(() => { fetch('/__mesa/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: text }).catch(() => { /* no server */ }); }, 1500);
  }, 400);
}
function parsePersisted(raw: string): { sessions: Session[]; settings: AppState['settings']; activeSessionId: Id } | null {
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p.sessions) || !p.sessions.length) return null;
    const sessions: Session[] = p.sessions.map((s: Session) => ({
      ...newSession({ title: s.title ?? 'Session' }), ...s, cancel: undefined, pendingApproval: undefined, queued: [],
      state: s.state === 'running' || s.state === 'awaiting' ? 'idle' : s.state,
      turns: (s.turns ?? []).map((t) => (t.status === 'running' || t.status === 'awaiting' ? { ...t, status: 'cancelled' as const, endedAt: t.endedAt ?? Date.now(), blocks: t.blocks.map((b) => (b.type === 'text' ? { ...b, streaming: false } : b.type === 'tool' && (b.call.status === 'running' || b.call.status === 'awaiting-approval') ? { ...b, call: { ...b.call, status: 'error' as const, error: 'Interrupted by reload' } } : b)) } : t)),
    }));
    return { sessions, settings: { ...initial.settings, ...(p.settings ?? {}), shortcuts: { ...(p.settings?.shortcuts ?? {}) } }, activeSessionId: p.activeSessionId ?? sessions[0].id };
  } catch { return null; }
}
function loadPersisted(): { sessions: Session[]; settings: AppState['settings']; activeSessionId: Id } | null {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? parsePersisted(raw) : null; } catch { return null; }
}
async function loadServerState(): Promise<{ sessions: Session[]; settings: AppState['settings']; activeSessionId: Id } | null> {
  try { const r = await fetch('/__mesa/state', { cache: 'no-store' }); if (!r.ok) return null; return parsePersisted(await r.text()); } catch { return null; }
}
function emit() {
  version++;
  state = { ...state };
  listeners.forEach((l) => l());
  persistSoon();
}
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getState = () => state;
export const getVersion = () => version;

// ---------- structural helpers ----------
function updateSession(id: Id, fn: (s: Session) => void) {
  state = { ...state, sessions: state.sessions.map((s) => (s.id === id ? (() => { const c = { ...s }; fn(c); c.updatedAt = Date.now(); return c; })() : s)) };
  emit();
}
function updateTurn(sessionId: Id, turnId: Id, fn: (t: Turn) => void) {
  updateSession(sessionId, (s) => { s.turns = s.turns.map((t) => (t.id === turnId ? (() => { const c = { ...t, blocks: [...t.blocks] }; fn(c); return c; })() : t)); });
}
function updateBlock(sessionId: Id, turnId: Id, blockId: Id, fn: (b: Block) => void) {
  updateTurn(sessionId, turnId, (t) => {
    t.blocks = t.blocks.map((b) => (b.id === blockId ? (() => { const c: Block = b.type === 'tool' ? { ...b, call: { ...b.call } } : { ...b }; fn(c); return c; })() : b));
  });
}
function updateCall(sessionId: Id, turnId: Id, blockId: Id, fn: (c: ToolCall) => void) {
  updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'tool') fn(b.call); });
}
function pushTimeline(sessionId: Id, e: Omit<TLEvent, 'id' | 'ts'>) {
  updateSession(sessionId, (s) => { s.timeline = [...s.timeline, { ...e, id: uid(), ts: Date.now() }]; });
}
export function toast(text: string, kind: Toast['kind'] = 'info', icon?: string, action?: Toast['action'], ttlMs?: number) {
  const t: Toast = { id: uid(), text, kind, at: Date.now(), icon, action, ttlMs };
  state = { ...state, toasts: [...state.toasts, t] };
  emit();
  setTimeout(() => { state = { ...state, toasts: state.toasts.filter((x) => x.id !== t.id) }; emit(); }, ttlMs ?? 4200);
}
export function dismissToast(id: Id) { state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) }; emit(); }

// ---------- generic setters ----------
export function setActive(id: Id) {
  if (state.activeSessionId === id && state.page === 'session') return;
  state = { ...state, activeSessionId: id, page: 'session', showcase: state.showcase?.sessionId === id ? state.showcase : null, canvasArtifact: state.canvasArtifact?.sessionId === id ? state.canvasArtifact : null };
  emit();
}
export function newSessionAction() {
  const s = newSession({ title: 'New session' });
  if (state.showcase && !state.showcase.minimized) minimiseShowcase();
  state = { ...state, sessions: [s, ...state.sessions], activeSessionId: s.id, page: 'session' };
  emit();
  return s.id;
}
export function renameSession(id: Id, title: string) { updateSession(id, (s) => { s.title = title || s.title; }); }
export function toggleRail() { state = { ...state, rail: { ...state.rail, open: !state.rail.open } }; emit(); }
export function setRailSearch(q: string) { state = { ...state, rail: { ...state.rail, search: q } }; emit(); }
export function toggleGroup(g: string) { state = { ...state, rail: { ...state.rail, collapsed: { ...state.rail.collapsed, [g]: !state.rail.collapsed[g] } } }; emit(); }
export function setDockTab(tab: DockTab, open = true) { state = { ...state, dock: { ...state.dock, tab, open } }; emit(); }
export function toggleDock() { state = { ...state, dock: { ...state.dock, open: !state.dock.open } }; emit(); }
export function setDockFloating(f: boolean) { state = { ...state, dock: { ...state.dock, floating: f } }; emit(); }
export function setDockWidth(w: number) { state = { ...state, settings: { ...state.settings, dockWidth: Math.min(72, Math.max(26, w)) } }; emit(); }
export function setSidebarWidth(w: number) { state = { ...state, settings: { ...state.settings, sidebarWidth: Math.min(420, Math.max(56, w)) } }; emit(); }
export function togglePalette(open?: boolean) { state = { ...state, palette: { ...state.palette, open: open ?? !state.palette.open, query: '' } }; emit(); }
export function setPaletteQuery(q: string) { state = { ...state, palette: { ...state.palette, query: q } }; emit(); }
export function openPage(p: AppState['page']) { state = { ...state, page: p, gallery: { ...state.gallery, open: false } }; emit(); }
export function toggleGallery(open?: boolean) { state = { ...state, gallery: { ...state.gallery, open: open ?? !state.gallery.open } }; emit(); }
export function setGalleryFilter(f: Partial<AppState['gallery']>) { state = { ...state, gallery: { ...state.gallery, ...f } }; emit(); }
export function updateSettings(patch: Partial<AppState['settings']>) { state = { ...state, settings: { ...state.settings, ...patch } }; emit(); }
export function setCanvasSplit(v: number | null) { state = { ...state, canvasSplit: v }; emit(); }
export function openBesideChat(sessionId: Id, artifactId: Id) {
  // Make room: cap the dock so the thread and the canvas each get a usable column.
  state = { ...state, canvasSplit: 50, canvasArtifact: { sessionId, artifactId }, settings: { ...state.settings, dockWidth: Math.min(state.settings.dockWidth, 34) } };
  emit();
}
export function closeCanvas() { state = { ...state, canvasSplit: null, canvasArtifact: null }; emit(); }
export function setMode(sessionId: Id, mode: Session['mode']) { updateSession(sessionId, (s) => { s.mode = mode; }); }
export function setPreset(sessionId: Id, preset: Preset) { updateSession(sessionId, (s) => { s.preset = preset; }); toast(`Permission preset → ${presetLabel(preset)}`, preset === 'full-access' ? 'warning' : 'info'); }
export function setModel(sessionId: Id, model: string) { updateSession(sessionId, (s) => { s.model = model; }); }
export function newTerminal(sessionId: Id) {
  const s = state.sessions.find((x) => x.id === sessionId); if (!s) return;
  const run: Run = { id: uid(), sessionId, owner: 'user', runtime: 'host', command: 'shell', cwd: 'mesa-demo', preset: s.preset, status: 'running', startedAt: Date.now(), lines: ['Mesa shell (simulated PTY) — type help, ls, git status, pnpm test, clear'], background: false };
  updateSession(sessionId, (ss) => { ss.runs = [...ss.runs, run]; ss.selectedRunId = run.id; });
  setDockTab('run');
  return run.id;
}
export function selectRun(sessionId: Id, runId?: Id) { updateSession(sessionId, (s) => { s.selectedRunId = runId; }); }
export function killRun(sessionId: Id, runId: Id) {
  updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === runId ? { ...r, status: 'killed', endedAt: Date.now(), lines: [...r.lines, '', '^C  (killed by user)'] } : r)); });
  toast('Job killed', 'warning');
}
export function restartRun(sessionId: Id, runId: Id) {
  const s = state.sessions.find((x) => x.id === sessionId); const r = s?.runs.find((x) => x.id === runId);
  if (!s || !r) return;
  const nr: Run = { ...r, id: uid(), status: 'running', startedAt: Date.now(), endedAt: undefined, exitCode: undefined, lines: [`$ ${r.command}`, ''] };
  updateSession(sessionId, (ss) => { ss.runs = [...ss.runs, nr]; ss.selectedRunId = nr.id; });
  pushTimeline(sessionId, { label: `run ${r.command}`, kind: 'run' });
  toast(`Restarted ${r.command}`, 'info');
}
export function pinArtifact(sessionId: Id, artifactId: Id) {
  updateSession(sessionId, (s) => { s.artifacts = s.artifacts.map((a) => (a.id === artifactId ? { ...a, pinned: !a.pinned } : a)); });
  const a = state.sessions.find((s) => s.id === sessionId)?.artifacts.find((x) => x.id === artifactId);
  if (a?.pinned) toast(`Pinned ${a.title} to Gallery`, 'success');
}
export function dismissShowcase() {
  const sc = state.showcase; if (!sc) return;
  state = { ...state, showcase: null, tray: state.tray.filter((t) => !(t.sessionId === sc.sessionId && t.turnId === sc.turnId)) };
  emit();
}
export function minimiseShowcase() {
  const sc = state.showcase; if (!sc) return;
  const sess = state.sessions.find((s) => s.id === sc.sessionId);
  const n = sess?.turns.find((t) => t.id === sc.turnId)?.deliverables.length ?? 0;
  state = { ...state, showcase: null, tray: [...state.tray, { id: uid(), title: `${n} deliverable${n === 1 ? '' : 's'}`, subtitle: sess?.title ?? '', sessionId: sc.sessionId, turnId: sc.turnId, kind: 'showcase' }] };
  emit();
}
export function restoreFromTray(itemId: Id) {
  const item = state.tray.find((t) => t.id === itemId); if (!item) return;
  state = { ...state, tray: state.tray.filter((t) => t.id !== itemId), showcase: { sessionId: item.sessionId, turnId: item.turnId, minimized: false, entering: true } };
  emit();
}
export function setCheckpoint(sessionId: Id, label: string, auto = false) {
  const s = state.sessions.find((x) => x.id === sessionId); if (!s) return;
  const cp: Checkpoint = { id: uid(), seq: s.timeline.length, label, at: Date.now(), auto };
  updateSession(sessionId, (ss) => { ss.checkpoints = [...ss.checkpoints, cp]; });
  pushTimeline(sessionId, { label: `checkpoint · ${label}`, kind: 'checkpoint' });
}

export function insertIntoComposer(text: string) { state = { ...state, insert: { text, n: Date.now() } }; emit(); }
export function clearInsert() { if (state.insert) { state = { ...state, insert: null }; } }
export function openCheat() { state = { ...state, cheat: true }; emit(); }
export function closeCheat() { if (state.cheat) { state = { ...state, cheat: false }; emit(); } }
export function openPublish(sessionId: Id, artifactId: Id) { state = { ...state, publish: { sessionId, artifactId } }; emit(); }
export function closePublish() { state = { ...state, publish: null }; emit(); }
export function setTour(step: number | null) { state = { ...state, tour: step }; emit(); }
export function isLiveAgent() { const p = state.settings.provider; return state.settings.agent === 'live' && !!p?.baseUrl && (!!p.apiKey || p.preset === 'mock'); }
export function isAcpAgent() { return state.settings.agent === 'acp'; }

/** One turn driven by an external ACP agent (see agent/acp.ts); the agent process is owned by scripts/serve.mjs. */
export async function runAcpTurn(sessionId: Id, turnId: Id) {
  const s0 = state.sessions.find((x) => x.id === sessionId); if (!s0) return;
  const turn = s0.turns.find((t) => t.id === turnId); if (!turn) return;
  if (s0.model !== 'acp') updateSession(sessionId, (s) => { s.model = 'acp'; });
  const started = Date.now();
  const token = { cancelled: false };
  updateSession(sessionId, (s) => { s.state = 'running'; s.cancel = () => { token.cancelled = true; acpCancel(sessionId); }; });
  const blockId = uid();
  updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: blockId, type: 'text', text: '', streaming: true }); });
  pushTimeline(sessionId, { label: 'acp · session/prompt', kind: 'tool', callId: turnId });
  let textAll = '';
  await runAcpPrompt(sessionId, turn.user, {
    appendText: (text) => { textAll += text; updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') b.text += text; }); },
    appendThought: (text) => updateTurn(sessionId, turnId, (t) => { t.thinking = ((t.thinking ?? '') + text).slice(-600); }),
    addTool: (call) => updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: uid(), type: 'tool', call }); }),
    updateTool: (callId, patch) => updateTurn(sessionId, turnId, (t) => { t.blocks = t.blocks.map((b) => (b.type === 'tool' && b.call.id === callId ? { ...b, call: { ...b.call, ...patch } } : b)); }),
    requestPermission: async ({ callId, title, command, options }) => {
      // Locate the tool row for this call (created by the preceding tool event) or add one.
      let blockIdForCall: Id | undefined;
      updateTurn(sessionId, turnId, (t) => { const b = t.blocks.find((x) => x.type === 'tool' && x.call.id === callId); if (b) blockIdForCall = b.id; else { const nb = uid(); t.blocks.push({ id: nb, type: 'tool', call: { id: callId, name: 'tool', title, subtitle: 'acp', status: 'running', startedAt: Date.now(), runtime: 'host' } }); blockIdForCall = nb; } });
      const option = (re: RegExp) => options.find((o) => re.test(o.kind))?.optionId;
      const decision = await requestApproval(sessionId, turnId, blockIdForCall!, callId, { kind: 'shell', title: title || 'Agent permission request', detail: command || title, flags: [], risk: { level: 'medium', rationale: 'Requested by the ACP agent.' } }, false);
      updateCall(sessionId, turnId, blockIdForCall!, (c) => { c.decision = decision; });
      if (decision.action === 'deny') return { optionId: option(/reject/) ?? options[0]?.optionId ?? 'reject' };
      if (decision.action === 'allow-always') return { optionId: option(/allow_always/) ?? option(/allow/) ?? options[0]?.optionId ?? 'allow' };
      return { optionId: option(/allow_once/) ?? option(/allow/) ?? options[0]?.optionId ?? 'allow' };
    },
    finish: (r) => {
      updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') { b.streaming = false; if (r.error) b.text += `\n\n> **ACP error** — ${r.error}`; } });
      if (!textAll && !r.error) updateTurn(sessionId, turnId, (t) => { t.blocks = t.blocks.filter((b) => b.id !== blockId); });
      const cur = state.sessions.find((x) => x.id === sessionId)?.turns.find((t) => t.id === turnId); if (!cur) return;
      const cancelled = token.cancelled || r.stopReason === 'cancelled';
      const toolCount = cur.blocks.filter((b) => b.type === 'tool').length;
      const usage: Usage = { inputTokens: Math.round(turn.user.length / 4), outputTokens: Math.round(textAll.length / 4), cachedTokens: 0, costUsd: 0, latencyMs: Date.now() - started };
      updateSession(sessionId, (ss) => {
        ss.state = 'idle'; ss.cancel = undefined; ss.pendingApproval = undefined;
        ss.turns = ss.turns.map((t) => (t.id === turnId ? { ...t, status: cancelled ? 'cancelled' : 'done', endedAt: Date.now(), usage, blocks: t.blocks.map((b) => (b.type === 'tool' && b.call.status === 'running' ? { ...b, call: { ...b.call, status: 'error' as const, error: 'Interrupted', endedAt: Date.now() } } : b)) } : t));
        ss.tokens = Math.min(ss.contextMax, ss.tokens + usage.inputTokens + usage.outputTokens);
      });
      pushTimeline(sessionId, { label: cancelled ? 'turn cancelled' : 'turn ended', kind: 'turn', ms: usage.latencyMs });
      if (toolCount && !cancelled) toast('ACP agent finished', 'success');
    },
    cancelToken: () => token,
  });
}
export function focusCall(callId: Id) { state = { ...state, focus: { callId, n: Date.now() } }; emit(); }
export function openAdhocPreview(title: string, html: string) { state = { ...state, adhoc: { title, html }, dock: { ...state.dock, tab: 'preview', open: true } }; emit(); }
export function clearAdhocPreview() { state = { ...state, adhoc: null }; emit(); }
export function deleteSession(id: Id) {
  const wasActive = state.activeSessionId === id;
  const index = state.sessions.findIndex((s) => s.id === id);
  const removed = state.sessions[index];
  if (!removed) return;
  const sessions = state.sessions.filter((s) => s.id !== id);
  if (!sessions.length) sessions.unshift(newSession({ title: 'New session' }));
  state = { ...state, sessions, activeSessionId: wasActive ? sessions[0].id : state.activeSessionId, showcase: state.showcase?.sessionId === id ? null : state.showcase, tray: state.tray.filter((t) => t.sessionId !== id), canvasArtifact: state.canvasArtifact?.sessionId === id ? null : state.canvasArtifact };
  emit();
  toast('Session deleted', 'info', undefined, { label: 'Undo', run: () => { state = { ...state, sessions: [...state.sessions.slice(0, index), removed, ...state.sessions.slice(index)] }; emit(); } }, 7000);
}
export function notify(title: string, body: string) {
  if (!state.settings.notifications) return;
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification(title, { body }); } catch { /* blocked */ }
}
export async function requestNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  try { if (typeof Notification === 'undefined') return 'unsupported'; return await Notification.requestPermission(); } catch { return 'unsupported'; }
}

// ---------- terminal (simulated PTY) ----------
const pendingInput = new Map<Id, string>();
export function terminalInput(sessionId: Id, runId: Id, data: string) {
  const cur = pendingInput.get(runId) ?? '';
  if (data === '\r' || data === '\n') {
    const line = cur.trim();
    pendingInput.set(runId, '');
    const out = fakeShell(line);
    updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === runId ? { ...r, lines: [...r.lines, ...out] } : r)); });
    if (line === 'clear') updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === runId ? { ...r, lines: [] } : r)); });
    return;
  }
  if (data === '\u007f') { pendingInput.set(runId, cur.slice(0, -1)); return; }
  if (data.length === 1 && data.charCodeAt(0) >= 32) pendingInput.set(runId, cur + data);
}
function fakeShell(line: string): string[] {
  if (!line) return [''];
  const [cmd, ...rest] = line.split(/\s+/);
  switch (cmd) {
    case 'help': return ['mesa shell (simulated) — try: ls · pwd · git status · pnpm test · pnpm dev · clear', ''];
    case 'ls': return ['src/  tests/  package.json  README.md  vite.config.ts', ''];
    case 'pwd': return ['/mesa-demo', ''];
    case 'git': return rest[0] === 'status' ? ['On branch main', 'Changes not staged for commit:', '  modified:   src/App.tsx', '  modified:   src/styles.css', ''] : ['git ' + rest.join(' ') + ' — ok', ''];
    case 'pnpm': return rest[0] === 'test' ? ['> vitest run', ' ✓ src (12 tests) 1.4s', ''] : rest[0] === 'dev' ? ['VITE ready → http://localhost:5173', ''] : ['pnpm ' + rest.join(' ') + ' — done', ''];
    case 'echo': return [rest.join(' '), ''];
    default: return [`'${cmd}' is not recognised. Type 'help'.`, ''];
  }
}

// ---------- approvals ----------
const approvalResolvers = new Map<Id, (d: Decision) => void>();
export function decide(sessionId: Id, decision: Decision) {
  const s = state.sessions.find((x) => x.id === sessionId); const ap = s?.pendingApproval; if (!s || !ap) return;
  approvalResolvers.get(ap.id)?.(decision);
  approvalResolvers.delete(ap.id);
  updateSession(sessionId, (ss) => { ss.pendingApproval = undefined; ss.state = ss.turns.some((t) => t.status === 'running') ? 'running' : 'idle'; if (decision.action === 'allow-session') ss.allowSessionShell = true; });
  pushTimeline(sessionId, { label: `approval ${decision.action}`, kind: 'approval' });
}

// ---------- agent runner ----------
function makeArtifact(seed: ArtifactSeed, sessionId: Id, turnId: Id): Artifact {
  return { ...seed, id: uid(), sessionId, turnId, createdAt: Date.now() };
}

function computeUsage(turn: Turn): Usage {
  const out = turn.blocks.filter((b) => b.type === 'text').reduce((n, b) => n + b.text.length, 0);
  const tools = turn.blocks.filter((b) => b.type === 'tool').length;
  const inputTokens = Math.round(900 + turn.user.length / 4 + tools * 420);
  const outputTokens = Math.round(out / 4 + tools * 60);
  return { inputTokens, outputTokens, cachedTokens: Math.round(inputTokens * 0.72), costUsd: +(inputTokens * 0.0000015 + outputTokens * 0.000006).toFixed(4), latencyMs: (turn.endedAt ?? Date.now()) - turn.startedAt };
}

export async function runScenario(sessionId: Id, turnId: Id, scenario: Scenario, opts: { instant?: boolean } = {}) {
  const instant = !!opts.instant;
  const wait = (ms: number) => (instant ? Promise.resolve() : sleep(ms));
  const token = { cancelled: false };
  updateSession(sessionId, (s) => { s.cancel = () => { token.cancelled = true; }; s.state = 'running'; });
  let planIdx = 0;
  let goalTotal = 0;
  const advancePlan = () => {
    const s = state.sessions.find((x) => x.id === sessionId); if (!s?.plan) return;
    const items = s.plan.items.map((it, i) => ({ ...it, state: i < planIdx ? 'done' : i === planIdx ? 'doing' : 'todo' }));
    planIdx++;
    updateSession(sessionId, (ss) => { if (ss.plan) ss.plan = { ...ss.plan, items: items.map((it, i) => ({ ...it, state: i < planIdx ? 'done' : i === planIdx ? 'doing' : 'todo' })) }; });
  };

  for (const step of scenario.steps as SceneStep[]) {
    if (token.cancelled) break;
    switch (step.t) {
      case 'think': {
        const id = uid();
        updateTurn(sessionId, turnId, (t) => { t.thinking = ''; t.blocks.push({ id, type: 'text', text: '', streaming: true }); });
        const marker = '> ';
        await streamText(sessionId, turnId, id, marker + step.text + '\n\n', instant, 2);
        updateTurn(sessionId, turnId, (t) => { t.blocks = t.blocks.filter((x) => x.id !== id); t.thinking = step.text; });
        break;
      }
      case 'text': {
        const id = uid();
        updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id, type: 'text', text: '', streaming: true }); });
        await streamText(sessionId, turnId, id, step.text, instant, step.speed ?? 1);
        break;
      }
      case 'plan': {
        updateSession(sessionId, (s) => { s.plan = { items: step.items.map((text, i) => ({ text, state: i === 0 ? 'doing' : 'todo' })), reviewed: false }; });
        pushTimeline(sessionId, { label: `plan · ${step.items.length} steps`, kind: 'turn' });
        await wait(300);
        break;
      }
      case 'goal': {
        goalTotal = step.total;
        updateSession(sessionId, (s) => { s.goal = { text: step.text, done: 0, total: step.total, status: 'active', rounds: 1 }; });
        if (!instant) toast('Goal recorded — I will keep working across rounds', 'info');
        await wait(200);
        break;
      }
      case 'agents': {
        const nodes: AgentNode[] = step.agents.map((a) => ({ id: uid(), name: a.name, role: a.role, status: 'running', cost: 0, startedAt: Date.now() }));
        updateSession(sessionId, (s) => { s.agents = [...s.agents, ...nodes]; });
        nodes.forEach((n) => pushTimeline(sessionId, { label: `spawn ${n.name} · ${n.role}`, kind: 'tool' }));
        if (!instant) toast(`${step.agents.length} subagents spawned`, 'info');
        await wait(300);
        break;
      }
      case 'agentDone': {
        updateSession(sessionId, (s) => { s.agents = s.agents.map((a) => (a.name === step.name && a.status === 'running' ? { ...a, status: 'done', endedAt: Date.now(), cost: +(Math.random() * 0.2 + 0.05).toFixed(3), note: step.note } : a)); });
        await wait(150);
        break;
      }
      case 'checkpoint': {
        setCheckpoint(sessionId, step.label, step.auto);
        await wait(120);
        break;
      }
      case 'wait': await wait(step.ms); break;
      case 'tool': await execTool(step, sessionId, turnId, wait, instant, advancePlan); break;
      case 'run': await execRun(step, sessionId, turnId, wait, instant, advancePlan); break;
      case 'present': {
        // Reuse the artifact already created for this path in this turn (edit → present), else create it.
        const artifacts = step.artifacts.map((seed) => {
          const s0 = state.sessions.find((x) => x.id === sessionId);
          const existing = s0?.artifacts.find((x) => x.turnId === turnId && x.path === seed.path);
          if (existing) return { ...existing, ...seed, id: existing.id, sessionId, turnId, createdAt: existing.createdAt, version: (existing.version ?? 1) };
          return makeArtifact(seed, sessionId, turnId);
        });
        updateSession(sessionId, (s) => {
          const ids = new Set(artifacts.map((a) => a.id));
          s.artifacts = [...s.artifacts.filter((a) => !ids.has(a.id)), ...artifacts];
          s.hasDeliverables = true;
          s.turns = s.turns.map((t) => (t.id === turnId ? { ...t, deliverables: [...t.deliverables, ...artifacts.map((a) => a.id)] } : t));
        });
        pushTimeline(sessionId, { label: `present · ${artifacts.length} deliverable${artifacts.length === 1 ? '' : 's'}`, kind: 'present' });
        advancePlan();
        if (!instant) triggerShowcase(sessionId, turnId);
        await wait(200);
        break;
      }
    }
  }

  // finish
  const s = state.sessions.find((x) => x.id === sessionId); const turn = s?.turns.find((t) => t.id === turnId);
  if (!turn) return;
  const cancelled = token.cancelled;
  const usage = computeUsage({ ...turn, endedAt: Date.now() });
  updateSession(sessionId, (ss) => {
    ss.state = 'idle';
    ss.cancel = undefined;
    ss.turns = ss.turns.map((t) => (t.id === turnId ? { ...t, status: cancelled ? 'cancelled' : 'done', endedAt: Date.now(), usage, blocks: t.blocks.map((b) => (b.type === 'text' ? { ...b, streaming: false } : b)) } : t));
    ss.tokens = Math.min(ss.contextMax, ss.tokens + usage.inputTokens);
    ss.cost = +(ss.cost + usage.costUsd).toFixed(4);
    ss.cacheHit = usage.cachedTokens / Math.max(1, usage.inputTokens);
    if (ss.goal && goalTotal) { ss.goal = { ...ss.goal, done: Math.min(ss.goal.total, ss.goal.done + 1), rounds: ss.goal.rounds + 1, status: ss.goal.done + 1 >= ss.goal.total ? 'complete' : 'active' }; }
    if (ss.plan) ss.plan = { ...ss.plan, items: ss.plan.items.map((it) => ({ ...it, state: 'done' })) };
  });
  pushTimeline(sessionId, { label: cancelled ? 'turn cancelled' : 'turn ended', kind: 'turn', ms: usage.latencyMs });
  if (!instant && !cancelled) {
    const deliverables = turn.deliverables.length;
    if (deliverables) toast(`${deliverables} deliverable${deliverables === 1 ? '' : 's'} ready · ${(usage.latencyMs / 1000).toFixed(1)}s`, 'success');
  }
}

function triggerShowcase(sessionId: Id, turnId: Id) {
  if (state.settings.dnd) {
    toast('Deliverables docked to Gallery (do not disturb)', 'info');
    state = { ...state, showcase: { sessionId, turnId, minimized: true, entering: false } };
    emit();
    setTimeout(() => { if (state.showcase?.turnId === turnId && state.showcase.minimized) dismissShowcase(); }, 4000);
    return;
  }
  // stacking: minimise existing
  if (state.showcase && !state.showcase.minimized) minimiseShowcase();
  state = { ...state, showcase: { sessionId, turnId, minimized: false, entering: true } };
  emit();
  const n = state.sessions.find((s) => s.id === sessionId)?.turns.find((t) => t.id === turnId)?.deliverables.length ?? 0;
  notify('Mesa · deliverables ready', `${n} deliverable${n === 1 ? '' : 's'} in ${state.sessions.find((s) => s.id === sessionId)?.title ?? 'session'}`);
  if (state.settings.effects && n >= 3) {
    const dock = state.dock.open ? (window.innerWidth * state.settings.dockWidth) / 100 : 0;
    setTimeout(() => { state = { ...state, confetti: { n: Date.now(), x: window.innerWidth - dock - 260, y: 120 } }; emit(); }, 380);
  }
  setTimeout(() => { if (state.showcase?.entering) { state = { ...state, showcase: { ...state.showcase, entering: false } }; emit(); } }, 500);
}

export function exportSession(sessionId: Id, format: 'jsonl' | 'md' = 'jsonl') {
  const s = state.sessions.find((x) => x.id === sessionId); if (!s) return;
  let content: string; let name: string; let type: string;
  if (format === 'md') {
    content = `# ${s.title}\n\n` + s.turns.map((t) => `## You\n\n${t.user}\n\n## Mesa\n\n` + t.blocks.map((b) => b.type === 'text' ? b.text : `\`${b.call.name} ${b.call.title}\` — ${b.call.status}`).join('\n\n')).join('\n\n---\n\n');
    name = `${s.title.replace(/[^a-z0-9]+/gi, '-')}.md`; type = 'text/markdown';
  } else {
    content = s.timeline.map((e) => JSON.stringify({ seq: s.timeline.indexOf(e), ts: new Date(e.ts).toISOString(), type: e.kind, label: e.label, ms: e.ms })).join('\n') + '\n' + s.turns.map((t) => JSON.stringify({ type: 'turn', id: t.id, user: t.user, status: t.status, usage: t.usage, deliverables: t.deliverables })).join('\n');
    name = `${s.title.replace(/[^a-z0-9]+/gi, '-')}.jsonl`; type = 'application/x-ndjson';
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${name}`, 'success');
}
export function resetWorkspace() { try { localStorage.removeItem(LS_KEY); } catch {} location.reload(); }

async function streamText(sessionId: Id, turnId: Id, blockId: Id, text: string, instant: boolean, speed: number) {
  if (instant) { updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') { b.text = text; b.streaming = false; } }); return; }
  const per = 2 * speed;
  for (let i = 0; i < text.length; i += per) {
    const chunk = text.slice(i, i + per);
    updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') b.text += chunk; });
    const pause = /[.,;:!?]\s/.test(chunk) ? 60 : chunk.includes('\n') ? 90 : 14;
    await sleep(pause);
  }
  updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') b.streaming = false; });
}

async function requestApproval(sessionId: Id, turnId: Id, blockId: Id, callId: Id, ap: Omit<Approval, 'id' | 'callId' | 'requestedAt'>, instant: boolean): Promise<Decision> {
  const approval: Approval = { ...ap, id: uid(), callId, requestedAt: Date.now() };
  updateCall(sessionId, turnId, blockId, (c) => { c.status = 'awaiting-approval'; c.approval = approval; });
  updateSession(sessionId, (s) => { s.pendingApproval = approval; s.state = 'awaiting'; });
  pushTimeline(sessionId, { label: `approval requested · ${approval.title}`, kind: 'approval', callId });
  if (!instant) notify('Mesa needs your approval', `${approval.title} · ${state.sessions.find((x) => x.id === sessionId)?.title ?? ''}`);
  if (instant) {
    updateSession(sessionId, (s) => { s.pendingApproval = undefined; s.state = 'running'; });
    return { action: 'allow-once' };
  }
  return new Promise<Decision>((resolve) => { approvalResolvers.set(approval.id, resolve); });
}

async function execTool(step: Extract<SceneStep, { t: 'tool' }>, sessionId: Id, turnId: Id, wait: (ms: number) => void | Promise<void>, instant: boolean, advancePlan: () => void) {
  const blockId = uid(); const callId = uid();
  const call: ToolCall = { id: callId, name: step.name, title: step.title, subtitle: step.subtitle, status: 'running', startedAt: Date.now(), runtime: step.runtime, preset: state.sessions.find((s) => s.id === sessionId)?.preset, stream: step.stream };
  updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: blockId, type: 'tool', call }); });
  pushTimeline(sessionId, { label: `${step.name} · ${step.title}`, kind: 'tool', callId });
  if (step.approval) {
    const d = await requestApproval(sessionId, turnId, blockId, callId, step.approval, instant);
    if (d.action === 'deny') {
      updateCall(sessionId, turnId, blockId, (c) => { c.status = 'denied'; c.decision = d; c.endedAt = Date.now(); c.error = d.reason ? `Denied: ${d.reason}` : 'Denied by user'; });
      const id = uid();
      updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id, type: 'text', text: '', streaming: true }); });
      await streamText(sessionId, turnId, id, `Understood — I **won't** ${step.approval.title.toLowerCase()}. ${d.reason ? `You said: "${d.reason}". ` : ''}Tell me how you'd like to proceed.`, instant, 2);
      return;
    }
    updateCall(sessionId, turnId, blockId, (c) => { c.decision = d; c.status = 'running'; });
  }
  await wait(step.ms);
  let artifactId: Id | undefined;
  if (step.artifact) {
    const a = makeArtifact(step.artifact, sessionId, turnId);
    artifactId = a.id;
    updateSession(sessionId, (s) => { s.artifacts = [...s.artifacts, a]; s.turns = s.turns.map((t) => (t.id === turnId ? { ...t, deliverables: t.deliverables } : t)); });
    pushTimeline(sessionId, { label: `artifact · ${a.title}`, kind: 'artifact' });
  }
  updateCall(sessionId, turnId, blockId, (c) => {
    c.status = step.error ? 'error' : 'success'; c.endedAt = Date.now(); c.ms = step.ms; c.output = step.output; c.diff = step.diff; c.artifactIds = artifactId ? [artifactId] : undefined; c.error = step.error;
    if (step.runId) c.runId = step.runId;
  });
  advancePlan();
}

async function execRun(step: Extract<SceneStep, { t: 'run' }>, sessionId: Id, turnId: Id, wait: (ms: number) => void | Promise<void>, instant: boolean, advancePlan: () => void) {
  const blockId = uid(); const callId = uid();
  const runtime = step.runtime;
  const call: ToolCall = { id: callId, name: step.runtime === 'kernel' ? 'python' : 'bash', title: step.command, subtitle: step.background ? 'background job' : `${step.runtime} · ${step.cwd}`, status: 'running', startedAt: Date.now(), runtime, preset: state.sessions.find((s) => s.id === sessionId)?.preset, stream: true };
  updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: blockId, type: 'tool', call }); });
  pushTimeline(sessionId, { label: `${step.command}`, kind: 'run', callId });
  if (step.approval) {
    const d = await requestApproval(sessionId, turnId, blockId, callId, step.approval, instant);
    if (d.action === 'deny') {
      updateCall(sessionId, turnId, blockId, (c) => { c.status = 'denied'; c.decision = d; c.endedAt = Date.now(); c.error = 'Denied by user'; });
      const id = uid(); updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id, type: 'text', text: '', streaming: true }); });
      await streamText(sessionId, turnId, id, `Skipped \`${step.command}\` — you denied it${d.reason ? ` ("${d.reason}")` : ''}. I can continue without it if you prefer.`, instant, 2);
      return;
    }
    updateCall(sessionId, turnId, blockId, (c) => { c.decision = d; c.status = 'running'; });
  }
  const run: Run = { id: uid(), sessionId, owner: step.owner ?? 'agent', runtime, command: step.command, cwd: step.cwd, preset: call.preset ?? 'workspace-write', status: 'running', startedAt: Date.now(), lines: [`$ ${step.command}`], background: !!step.background, port: step.port };
  updateSession(sessionId, (s) => { s.runs = [...s.runs, run]; s.selectedRunId = state.dock.tab === 'run' ? run.id : s.selectedRunId; });
  updateCall(sessionId, turnId, blockId, (c) => { c.runId = run.id; });
  await wait(instant ? 0 : 250);
  const interval = Math.max(60, Math.floor(step.ms / Math.max(1, step.lines.length)));
  for (const line of step.lines) {
    updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === run.id ? { ...r, lines: [...r.lines, line] } : r)); });
    updateCall(sessionId, turnId, blockId, (c) => { c.output = (c.output ? c.output + '\n' : '') + line; });
    await wait(instant ? 0 : interval);
  }
  const finalStatus = step.background ? 'running' : step.exitCode === 0 ? 'exited' : step.exitCode ? 'failed' : 'exited';
  let artifactId: Id | undefined;
  if (step.artifact) { const a = makeArtifact(step.artifact, sessionId, turnId); artifactId = a.id; updateSession(sessionId, (s) => { s.artifacts = [...s.artifacts, a]; }); pushTimeline(sessionId, { label: `artifact · ${a.title}`, kind: 'artifact' }); }
  updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === run.id ? { ...r, status: finalStatus as Run['status'], endedAt: step.background ? undefined : Date.now(), exitCode: step.exitCode, artifactId } : r)); });
  updateCall(sessionId, turnId, blockId, (c) => { c.status = step.exitCode && step.exitCode !== 0 ? 'error' : 'success'; c.endedAt = Date.now(); c.ms = step.ms; c.artifactIds = artifactId ? [artifactId] : undefined; });
  advancePlan();
}

// ---------- messaging ----------
export function send(text: string, opts: { mode?: 'queue' | 'inject' } = {}) {
  const s = state.sessions.find((x) => x.id === state.activeSessionId); if (!s) return;
  if (!text.trim()) return;
  if (s.state === 'running' || s.state === 'awaiting') {
    const q: QueuedMsg = { id: uid(), text: text.trim(), mode: opts.mode ?? 'queue' };
    updateSession(s.id, (ss) => { ss.queued = [...ss.queued, q]; });
    toast(opts.mode === 'inject' ? 'Will inject at the next tool call' : 'Queued — sends when the turn ends', 'info');
    return;
  }
  startTurn(s.id, text.trim());
}
function startTurn(sessionId: Id, text: string) {
  const turnId = uid();
  const turn: Turn = { id: turnId, user: text, status: 'running', startedAt: Date.now(), blocks: [], deliverables: [], usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, latencyMs: 0 } };
  updateSession(sessionId, (s) => { s.turns = [...s.turns, turn]; s.state = 'running'; });
  const title = text.length > 42 ? text.slice(0, 42).trimEnd() + '…' : text;
  if (state.sessions.find((x) => x.id === sessionId)?.title === 'New session') updateSession(sessionId, (s) => { s.title = title; });
  pushTimeline(sessionId, { label: `turn · ${title}`, kind: 'turn' });
  if (isAcpAgent()) runAcpTurn(sessionId, turnId);
  else if (isLiveAgent()) runModelTurn(sessionId, turnId);
  else runScenario(sessionId, turnId, pickScenario(text));
  return turnId;
}
const DEMO_FILES: Record<string, string> = {
  'package.json': '{ "name": "mesa-demo", "private": true, "version": "0.1.0", "scripts": { "dev": "vite", "build": "vite build", "test": "vitest run" }, "dependencies": { "react": "^19.1.0", "react-dom": "^19.1.0" }, "devDependencies": { "vite": "^7.0.0", "vitest": "^3.0.0", "typescript": "^5.6.0" } }',
  'README.md': '# mesa-demo\n\nVite + React sandbox used by Mesa demos.\n\n- `pnpm dev` → http://localhost:5173\n- `pnpm test` → vitest\n',
  'src/App.tsx': 'export default function App() {\n  const data = useWeekly();\n  return (\n    <Card>\n      <Pill live />\n      <h1>Pulse dashboard</h1>\n      <Bars values={data} />\n      <Stats runs={1284} success={0.982} />\n    </Card>\n  );\n}',
  'src/styles.css': '.card {\n  width: 420px;\n  padding: 28px;\n  border-radius: 20px;\n  background: linear-gradient(145deg, #161a21, #11141a);\n}\n\n.bar {\n  animation: grow 1.2s cubic-bezier(.2, .9, .25, 1) both;\n}',
  'src/lib/stats.ts': 'export function successRate(ok: number, total: number) {\n  return Number((ok / total).toFixed(3));\n}\n\nexport function sumRuns(runs: number[]) {\n  return runs.reduce((a, b) => a + b, 0);\n}',
  'data/revenue.csv': 'month,region,revenue\n2026-01,NA,182400\n2026-01,EMEA,120330\n2026-02,NA,201110\n… (1,204 rows)',
  'tests/chart.test.ts': 'import { describe, it, expect } from "vitest";\nimport { draw } from "../src/app/chart";\n\ndescribe("chart", () => {\n  it("draws an empty series", () => {\n    expect(draw({ points: [] })).toBe("");\n  });\n});',
};

function turnCancelled(sessionId: Id, turnId: Id): boolean {
  return state.sessions.find((x) => x.id === sessionId)?.turns.find((t) => t.id === turnId)?.status === 'cancelled';
}

function promptTitleOf(user: string): string {
  const t = user.replace(/^(please\s+)?(build|make|create|write|generate|design)\s+(me\s+)?(a|an|the)?\s*/i, '').replace(/[.?!].*$/, '').trim();
  const s = t.length > 34 ? t.slice(0, 34).trimEnd() + '…' : t;
  return s ? s.replace(/^./, (ch) => ch.toUpperCase()) : 'Generated app';
}

export async function runModelTurn(sessionId: Id, turnId: Id) {
  const cfg = state.settings.provider!;
  const s0 = state.sessions.find((x) => x.id === sessionId); if (!s0) return;
  if (s0.model !== cfg.model) updateSession(sessionId, (s) => { s.model = cfg.model; });
  const user = s0.turns.find((t) => t.id === turnId)!.user;
  const useTools = cfg.tools ?? (cfg.preset !== 'strata'); // Strata's endpoint hangs on tool definitions
  const history = s0.turns.filter((t) => t.id !== turnId && t.status === 'done').slice(-6);
  const messages: ChatMessage[] = [
    { role: 'system', content: useTools ? SYSTEM_PROMPT_TOOLS : SYSTEM_PROMPT_FENCE },
    ...history.flatMap((t) => [{ role: 'user' as const, content: t.user }, { role: 'assistant' as const, content: t.blocks.filter((b) => b.type === 'text').map((b) => (b as Extract<Block, { type: 'text' }>).text).join('\n\n') || '(no text)' }]),
    { role: 'user', content: user },
  ];
  const started = Date.now();
  const made: Artifact[] = [];
  let allText = '';
  let outTokens = 0;
  pushTimeline(sessionId, { label: `model · ${cfg.model}`, kind: 'tool' });

  for (let round = 0; round < 4; round++) {
    if (turnCancelled(sessionId, turnId)) break;
    const blockId = uid();
    updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: blockId, type: 'text', text: '', streaming: true }); });
    const handle = streamChat(cfg, messages, (_d, full) => updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') b.text = full; }), { onReasoning: (_r, full) => updateTurn(sessionId, turnId, (t) => { t.thinking = full.trim().slice(-600); }), tools: TOOLS, useTools });
    updateSession(sessionId, (s) => { s.cancel = () => { handle.abort(); }; });
    let result: StreamResult;
    try { result = await handle.done; }
    catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (aborted && turnCancelled(sessionId, turnId)) break; // user pressed Stop — not an error
      const msg = e instanceof Error ? e.message : String(e);
      updateBlock(sessionId, turnId, blockId, (b) => { if (b.type === 'text') { b.text += `\n\n> **Model error** — ${msg}`; b.streaming = false; } });
      toast('Model request failed: ' + msg.slice(0, 80), 'error');
      break;
    }
    allText += result.text + '\n';
    outTokens += Math.round((result.text.length + result.toolCalls.reduce((n, c) => n + c.function.arguments.length, 0)) / 4);
    updateTurn(sessionId, turnId, (t) => { t.blocks = t.blocks.filter((b) => b.id !== blockId || (b.type === 'text' && b.text.trim().length > 0)).map((b) => (b.id === blockId && b.type === 'text' ? { ...b, streaming: false } : b)); });
    if (!result.toolCalls.length) break;
    messages.push({ role: 'assistant', content: result.text || '', tool_calls: result.toolCalls });

    for (const call of result.toolCalls) {
      if (turnCancelled(sessionId, turnId)) break;
      let args: Record<string, string> = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* keep {} */ }
      const name = call.function.name;
      const title = name === 'bash' ? String(args.command ?? '') : name === 'present_html' ? `present ${args.title ?? 'artifact'}` : name === 'read_file' ? `read ${args.path ?? ''}` : name;
      const tb = uid(); const tcId = uid();
      const toolCall: ToolCall = { id: tcId, name, title, subtitle: 'live model', status: 'running', startedAt: Date.now(), runtime: name === 'bash' ? 'sandbox' : undefined, preset: state.sessions.find((x) => x.id === sessionId)?.preset };
      updateTurn(sessionId, turnId, (t) => { t.blocks.push({ id: tb, type: 'tool', call: toolCall }); });
      pushTimeline(sessionId, { label: `${name} · ${title}`, kind: name === 'bash' ? 'run' : 'tool', callId: tcId });
      let output = ''; let ok = true;

      if (name === 'bash') {
        const preset = state.sessions.find((x) => x.id === sessionId)?.preset ?? 'workspace-write';
        let allowed = true;
        const cur = state.sessions.find((x) => x.id === sessionId);
        if (preset !== 'full-access' && !cur?.allowSessionShell) {
          const cmd = String(args.command ?? '');
          const flags = ['rm -rf', 'sudo', '| sh', '| bash', 'curl ', 'git push', 'drop'].filter((f) => cmd.includes(f));
          const d = await requestApproval(sessionId, turnId, tb, tcId, { kind: 'shell', title: 'Run shell command', detail: cmd, flags, risk: { level: flags.length ? 'high' : 'medium', rationale: flags.length ? `Matches dangerous pattern(s): ${flags.join(', ')}` : state.settings.shell ? 'Requested by the live model — runs for real on this machine (inside the repository folder).' : 'Requested by the live model; runs in the demo sandbox.' } }, false);
          if (d.action === 'deny') { allowed = false; output = `Denied by user${d.reason ? `: ${d.reason}` : ''}`; }
        }
        if (allowed) {
          const cmd = String(args.command ?? '');
          const real = state.settings.shell;
          const cwd = String(args.cwd ?? (real ? '.' : 'mesa-demo'));
          const run: Run = { id: uid(), sessionId, owner: 'agent', runtime: real ? 'host' : 'sandbox', command: cmd, cwd, preset, status: 'running', startedAt: Date.now(), lines: [`$ ${cmd}`], background: false };
          updateSession(sessionId, (s) => { s.runs = [...s.runs, run]; });
          updateCall(sessionId, turnId, tb, (c) => { c.runId = run.id; c.runtime = real ? 'host' : 'sandbox'; });
          const push = (line: string) => { updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === run.id ? { ...r, lines: [...r.lines, line] } : r)); }); output = (output ? output + '\n' : '') + line; };
          let exit = 0;
          if (real) {
            try { const r = await runShellStream({ command: cmd, cwd, timeoutMs: 120_000, onLine: (stream, line) => push(stream === 'stderr' ? `[stderr] ${line}` : line) }); exit = r.exitCode; }
            catch (e) { push(`mesa: ${e instanceof Error ? e.message : String(e)}`); exit = -1; }
          } else {
            for (const line of fakeShell(cmd.split(/\s+/).join(' '))) { await sleep(120); push(line); }
          }
          updateSession(sessionId, (s) => { s.runs = s.runs.map((r) => (r.id === run.id ? { ...r, status: exit === 0 ? 'exited' : 'failed', exitCode: exit, endedAt: Date.now() } : r)); });
          if (exit !== 0) ok = false;
          if (state.dock.tab === 'run') selectRun(sessionId, run.id);
        } else ok = false;
      } else if (name === 'present_html') {
        const html = String(args.html ?? '');
        if (!html.trim()) { output = 'present_html called with empty html'; ok = false; }
        else if (made.some((a) => a.html === html)) { output = 'already presented in this turn — skipped duplicate'; }
        else {
          const title = String(args.title ?? '').trim() || promptTitleOf(user);
          const a = makeArtifact({ kind: 'app', title, html, path: `mesa-demo/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'}.html`, bytes: html.length, framework: 'HTML', verification: { tests: 'unknown', preview: 'ready', diff: false }, tags: ['generated'] }, sessionId, turnId);
          made.push(a);
          updateSession(sessionId, (s) => { s.artifacts = [...s.artifacts, a]; s.hasDeliverables = true; s.turns = s.turns.map((t) => (t.id === turnId ? { ...t, deliverables: [...t.deliverables, a.id] } : t)); });
          output = `presented ${title} (${html.length} bytes)`;
          updateCall(sessionId, turnId, tb, (c) => { c.artifactIds = [a.id]; });
          pushTimeline(sessionId, { label: `artifact · ${title}`, kind: 'artifact' });
        }
      } else if (name === 'read_file') {
        const path = String(args.path ?? '').replace(/^\.\//, '');
        output = DEMO_FILES[path] ?? `file not found: ${path}\n(demo workspace has: ${Object.keys(DEMO_FILES).join(', ')})`;
        if (!DEMO_FILES[path]) ok = false;
      } else { output = `unknown tool: ${name}`; ok = false; }

      updateCall(sessionId, turnId, tb, (c) => { c.status = ok ? 'success' : 'error'; c.endedAt = Date.now(); c.ms = Date.now() - toolCall.startedAt; c.output = output; });
      messages.push({ role: 'tool', tool_call_id: call.id, content: output.slice(0, 4000) });
    }
  }

  // Fallback: ```html fences in prose (model ignored the tool) → artifacts too
  for (const h of extractHtmlArtifacts(allText)) {
    if (made.some((a) => a.html === h.html)) continue;
    const title = h.title.startsWith('App ') ? promptTitleOf(user) : h.title;
    const a = makeArtifact({ kind: 'app', title, html: h.html, path: `mesa-demo/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'}.html`, bytes: h.html.length, framework: 'HTML', verification: { tests: 'unknown', preview: 'ready', diff: false }, tags: ['generated'] }, sessionId, turnId);
    made.push(a);
    updateSession(sessionId, (s) => { s.artifacts = [...s.artifacts, a]; s.hasDeliverables = true; s.turns = s.turns.map((t) => (t.id === turnId ? { ...t, deliverables: [...t.deliverables, a.id] } : t)); });
  }
  const inTok = Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 4); const outTok = outTokens || Math.round(allText.length / 4);
  const est = estimateCostUsd(cfg.model, inTok, outTok);
  const usage: Usage = { inputTokens: inTok, outputTokens: outTok, cachedTokens: 0, costUsd: est ?? 0, costEstimated: est !== null, latencyMs: Date.now() - started };
  const turn = state.sessions.find((x) => x.id === sessionId)?.turns.find((t) => t.id === turnId);
  if (!turn) return;
  const cancelled = turn.status === 'cancelled';
  updateSession(sessionId, (ss) => {
    ss.state = 'idle'; ss.cancel = undefined; ss.pendingApproval = undefined;
    ss.turns = ss.turns.map((t) => (t.id === turnId ? { ...t, status: cancelled ? 'cancelled' : 'done', endedAt: Date.now(), usage, blocks: t.blocks.map((b) => (b.type === 'text' ? { ...b, streaming: false } : b.type === 'tool' && b.call.status === 'running' ? { ...b, call: { ...b.call, status: 'error' as const, error: 'Interrupted', endedAt: Date.now() } } : b)) } : t));
    ss.tokens = Math.min(ss.contextMax, ss.tokens + usage.inputTokens + usage.outputTokens);
  });
  if (made.length && !cancelled) { pushTimeline(sessionId, { label: `present · ${made.length} deliverable${made.length === 1 ? '' : 's'}`, kind: 'present' }); triggerShowcase(sessionId, turnId); }
  pushTimeline(sessionId, { label: cancelled ? 'turn cancelled' : 'turn ended', kind: 'turn', ms: usage.latencyMs });
}
export function dequeue(sessionId: Id, id: Id) { updateSession(sessionId, (s) => { s.queued = s.queued.filter((q) => q.id !== id); }); }
export function flushQueue(sessionId: Id) {
  const s = state.sessions.find((x) => x.id === sessionId); if (!s || !s.queued.length) return;
  const [first, ...rest] = s.queued;
  updateSession(sessionId, (ss) => { ss.queued = rest; });
  setTimeout(() => startTurn(sessionId, first.text), 250);
}
export function cancelTurn(sessionId: Id) {
  const s = state.sessions.find((x) => x.id === sessionId);
  s?.cancel?.();
  const running = s?.turns.find((t) => t.status === 'running');
  if (running) updateSession(sessionId, (ss) => { ss.turns = ss.turns.map((t) => (t.id === running.id ? { ...t, status: 'cancelled', endedAt: Date.now() } : t)); ss.state = 'idle'; ss.pendingApproval = undefined; });
}

// ---------- seeding ----------
export async function seed() {
  // Browser copy first; if this is a fresh browser, fall back to the workspace state file served by Mesa.
  const saved = loadPersisted() ?? await loadServerState();
  if (saved) {
    state = { ...initial, sessions: saved.sessions, settings: saved.settings, activeSessionId: saved.activeSessionId, dock: { open: true, tab: 'artifacts', floating: false } };
  }
  // Bootstrap from mesa.config.json (served by serve.mjs): provider on first run, shell flag whenever enabled.
  try {
    const r = await fetch('/__mesa/config', { cache: 'no-store' });
    if (r.ok) {
      const cfg = await r.json();
      if (cfg?.provider?.baseUrl && !state.settings.provider?.baseUrl) {
        state = { ...state, settings: { ...state.settings, provider: { preset: 'custom', proxy: true, apiKey: '', model: '', ...cfg.provider }, agent: cfg.agent === 'live' ? 'live' : state.settings.agent } };
      }
      if (cfg?.shell === true) state = { ...state, settings: { ...state.settings, shell: true } };
    }
  } catch { /* not served by serve.mjs — fine */ }
  if (saved) { emit(); return; }
  // First run: open the guided tour once the seeded sessions are in place.
  state = { ...state, tour: 0 };
  const now = Date.now();
  const mk = (id: string, title: string, group: Session['group'], ago: number, scenarioId?: string) => newSession({ id, title, group, createdAt: now - ago, updatedAt: now - ago });
  const s1 = mk('s-app', 'Build a dashboard app', 'Today', 1000 * 60 * 60 * 2);
  const s2 = mk('s-chart', 'Analyse revenue data', 'Today', 1000 * 60 * 60 * 5, 'chart');
  const s3 = mk('s-test', 'Fix failing tests', 'Yesterday', 1000 * 60 * 60 * 26, 'test');
  const s4 = mk('s-refactor', 'Rename Series → TimeSeries', 'Yesterday', 1000 * 60 * 60 * 30, 'refactor');
  const s5 = mk('s-new', 'New session', 'Today', 0);
  state = { ...state, sessions: [s5, s1, s2, s3, s4], activeSessionId: 's-app', dock: { open: true, tab: 'artifacts', floating: false } };
  emit();
  const seedTurn = async (sessionId: Id, user: string, scen: Scenario) => {
    const turnId = uid();
    const turn: Turn = { id: turnId, user, status: 'running', startedAt: Date.now(), blocks: [], deliverables: [], usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, latencyMs: 0 } };
    updateSession(sessionId, (s) => { s.turns = [...s.turns, turn]; });
    await runScenario(sessionId, turnId, scen, { instant: true });
  };
  await seedTurn('s-app', 'Build a small flashy dashboard app with Vite', pickScenario('build app'));
  await seedTurn('s-chart', 'Analyse the revenue data and make a chart', pickScenario('chart'));
  await seedTurn('s-test', 'Run the tests and fix whatever fails', pickScenario('fix tests'));
  await seedTurn('s-refactor', 'Refactor: rename Series to TimeSeries across the repo', pickScenario('refactor'));
  // keep seeded sessions' timestamps realistic (the seeded turns just ran "in the past")
  const ago: Record<string, number> = { 's-app': 2, 's-chart': 5, 's-test': 26, 's-refactor': 30 };
  state = {
    ...state,
    sessions: state.sessions.map((s) => ago[s.id] ? { ...s, updatedAt: Date.now() - ago[s.id] * 3600_000, timeline: s.timeline.map((e) => ({ ...e, ts: e.ts - ago[s.id] * 3600_000 })), turns: s.turns.map((t) => ({ ...t, startedAt: t.startedAt - ago[s.id] * 3600_000, endedAt: t.endedAt ? t.endedAt - ago[s.id] * 3600_000 : undefined })) } : s),
  };
  state = { ...state, sessions: state.sessions.map((s) => s.id === 's-app' ? { ...s, plan: SEED_PLAN, runs: s.runs.map((r) => r.background ? { ...r, status: 'running' as const } : r) } : s) };
  state = { ...state, activeSessionId: 's-new' };
  emit();
}