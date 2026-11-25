import { useEffect, useRef, useState } from 'react';
import { X, Check, Info, AlertTriangle, OctagonAlert, Sun, Moon, Monitor, Sparkles, Puzzle, CalendarClock, Power, Keyboard, SlidersHorizontal } from 'lucide-react';
import { dismissToast, exportSession, requestNotifyPermission, resetWorkspace, toast, toggleGallery, toggleRail, updateSettings, revokeAlwaysAllow } from '../state/store';
import { startTour } from './Tour';
import { ShortcutEditor } from './ShortcutEditor';
import { acpStatus } from '../agent/acp';
import { listModels, PROVIDER_PRESETS, shellStatus, testProvider } from '../agent/provider';
import { ACCENTS, sc, shellName } from '../state/platform';
import { useStore } from '../state/useStore';

const ICON: Record<string, typeof Info> = { info: Info, success: Check, warning: AlertTriangle, error: OctagonAlert };

export function Toasts() {
  const st = useStore();
  // Anchor toasts just above the composer so they never cover the header, the showcase title or the composer controls.
  useEffect(() => {
    const measure = () => { const c = document.querySelector('.composer'); document.documentElement.style.setProperty('--composer-h', c ? `${c.getBoundingClientRect().height + 12}px` : '12px'); };
    const ro = new ResizeObserver(measure); const c = document.querySelector('.composer'); if (c) ro.observe(c);
    measure();
    return () => ro.disconnect();
  }, [st.page]);
  return (
    <div className="toasts" aria-live="polite">
      {st.toasts.map((t) => { const Icon = ICON[t.kind]; return <div key={t.id} className={'toast t-' + t.kind}><Icon size={14} /><span>{t.text}</span>{t.action && <button className="chip-btn on" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}<button className="icon-btn sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={12} /></button></div>; })}
    </div>
  );
}

export function SettingsPage() {
  const st = useStore();
  const s = st.settings;
  const Row = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => <div className="set-row"><div><b>{label}</b>{sub && <div className="set-sub">{sub}</div>}</div>{children}</div>;
  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => onChange(!on)}><i /></button>;
  return (
    <div className="page">
      <div className="page-head"><SlidersHorizontal size={16} /><b>Settings</b></div>
      <section className="set-section"><h4>Appearance</h4>
        <Row label="Theme"><div className="seg">{(['system', 'light', 'dark'] as const).map((t) => <button key={t} className={s.theme === t ? 'on' : ''} onClick={() => updateSettings({ theme: t })}>{t === 'light' ? <Sun size={12} /> : t === 'dark' ? <Moon size={12} /> : <Monitor size={12} />}{t}</button>)}</div></Row>
        <Row label="Density" sub="Row height and line spacing"><div className="seg">{(['comfortable', 'compact', 'terminal'] as const).map((d) => <button key={d} className={s.density === d ? 'on' : ''} onClick={() => updateSettings({ density: d })}>{d}</button>)}</div></Row>
        <Row label="Accent" sub="Re-tints buttons, streaming cursors, charts and the showcase"><div className="swatches" role="radiogroup" aria-label="Accent colour">{ACCENTS.map((a) => <button key={a.id} role="radio" aria-checked={s.accent === a.id} title={a.name} className={'swatch' + (s.accent === a.id ? ' on' : '')} style={{ ['--sw' as string]: a.dark }} onClick={() => updateSettings({ accent: a.id })} />)}</div></Row>
        <Row label="Completion effects" sub="Accent sweep and header glow when a turn finishes fully verified"><Toggle on={s.effects} onChange={(v) => updateSettings({ effects: v })} /></Row>
        <Row label="Do not disturb" sub="Showcases dock silently to the Gallery instead of sliding in"><Toggle on={s.dnd} onChange={(v) => updateSettings({ dnd: v })} /></Row>
        <Row label="Notifications" sub="Browser notifications for approvals and finished work while the window is in the background"><Toggle on={s.notifications} onChange={async (v) => { if (v) { const p = await requestNotifyPermission(); if (p !== 'granted') { toast(`Browser ${p === 'unsupported' ? 'does not support' : 'blocked'} notifications`, 'warning'); return; } } updateSettings({ notifications: v }); }} /></Row>
      </section>
      <section className="set-section"><h4>Keyboard</h4>
        <ShortcutEditor />
      </section>
      <section className="set-section"><h4>Agent</h4>
        <Row label="Agent backend" sub="Demo runs scripted scenarios offline; Live streams from an OpenAI-compatible endpoint; ACP drives an external agent (Claude Code, Codex, Gemini CLI…) over the Agent Client Protocol. HTML fences in answers become previewable artifacts.">
          <div className="seg">{(['demo', 'live', 'acp'] as const).map((m) => <button key={m} className={s.agent === m ? 'on' : ''} onClick={() => updateSettings({ agent: m })}>{m === 'demo' ? 'Demo script' : m === 'live' ? 'Live model' : 'ACP agent'}</button>)}</div>
        </Row>
        {s.agent === 'acp' && <AcpRow />}
        {s.agent === 'live' && <ProviderForm />}
      </section>
      <section className="set-section"><h4>Learn</h4>
        <Row label="Guided tour" sub="A 60-second spotlight walk through the rail, composer, header and dock"><button className="btn sm ghost" onClick={() => startTour()}>Replay tour</button></Row>
      </section>
      <section className="set-section"><h4>Data</h4>
        <Row label="Export current session" sub="JSONL ledger (every event) or Markdown transcript"><button className="btn sm ghost" onClick={() => exportSession(st.activeSessionId, 'jsonl')}>JSONL</button><button className="btn sm ghost" onClick={() => exportSession(st.activeSessionId, 'md')}>Markdown</button></Row>
        <Row label="Reset workspace" sub="Clears saved sessions, artifacts and settings, then reloads the demo"><button className="btn sm ghost" onClick={() => { if (confirm('Reset all sessions and settings?')) resetWorkspace(); }}>Reset…</button></Row>
      </section>
      <section className="set-section"><h4>Permissions</h4>
        <ShellRow />
        <ScopeMemoryRow />
        <Row label="Auto-review tool calls" sub="Before an approval is shown, the configured model labels the command risk in one line (6 s budget; off or unavailable → static rationale)"><Toggle on={s.autoReview} onChange={(on) => updateSettings({ autoReview: on })} /></Row>
      </section>
    </div>
  );
}

function ScopeMemoryRow() {
  const st = useStore();
  const LABEL: Record<string, string> = { bash: 'Shell commands without dangerous patterns', acp: 'ACP agent permission requests' };
  const rules = Object.entries(st.settings.alwaysAllow ?? {}).filter(([, v]) => v);
  return (
    <div className="set-row"><div><b>Scope memory</b><div className="set-sub">“Always allow for this repo” rules — dangerous shell patterns still prompt</div></div>
      {rules.length === 0 ? <span className="muted">no rules yet</span> : <div className="scope-rules">{rules.map(([k]) => <span key={k} className="scope-rule"><span>{LABEL[k] ?? k}</span><button className="icon-btn sm" title="Revoke" aria-label={`Revoke ${LABEL[k] ?? k}`} onClick={() => revokeAlwaysAllow(k)}><X size={12} /></button></span>)}</div>}
    </div>
  );
}

function AcpRow() {
  const st = useStore();
  const [status, setStatus] = useState<{ configured: boolean; command: string | null } | null>(null);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState('');
  useEffect(() => { acpStatus().then(setStatus); }, []);
  const tryAttach = async () => { setTest('testing'); try { const r = await fetch('/__mesa/acp/attach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId: st.activeSessionId }) }); const j = await r.json().catch(() => ({})); setMsg(j.error ?? `attached as ${j.agentSessionId}`); setTest(r.ok ? 'ok' : 'fail'); } catch (e) { setMsg(String(e)); setTest('fail'); } };
  return (
    <div className="provider-form">
      <div className="set-sub pf-hint">{status === null ? 'Checking server…' : status.configured ? `Server will spawn: ${status.command}. The command lives in mesa.config.json (the page cannot spawn processes itself).` : 'No ACP agent is configured — add "acp": { "command": "...", "args": ["..."] } to mesa.config.json and restart serve.mjs.'}</div>
      <div className="pf-actions"><span className={'pf-status ' + test}>{test === 'testing' ? 'Attaching…' : test === 'ok' ? `✓ ${msg}` : test === 'fail' ? `✗ ${msg}` : 'Agents speak JSON-RPC over stdio (initialize → session/new → session/prompt); permission requests appear as Mesa approvals.'}</span><button className="btn sm ghost" onClick={tryAttach} disabled={!status?.configured || test === 'testing'}>Attach &amp; test</button></div>
    </div>
  );
}

function ProviderForm() {
  const st = useStore();
  const defaults = { baseUrl: '', apiKey: '', model: '', preset: 'zai', proxy: true };
  const p = { ...defaults, ...(st.settings.provider ?? {}) };
  const toolsOn = p.tools ?? (p.preset !== 'strata');
  const preset = PROVIDER_PRESETS.find((x) => x.id === p.preset) ?? PROVIDER_PRESETS[0];
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [listing, setListing] = useState(false);
  const reqId = useRef(0); // ignores stale responses from a previous preset/test
  const set = (patch: Partial<typeof p>) => updateSettings({ provider: { ...p, ...patch } });
  const pickPreset = (id: string) => {
    const pr = PROVIDER_PRESETS.find((x) => x.id === id)!;
    reqId.current++;
    set({ preset: id, baseUrl: pr.baseUrl || p.baseUrl, model: pr.model || (models[0] ?? p.model) });
    setStatus('idle'); setMsg(''); setListing(false);
  };
  const test = async () => { const id = ++reqId.current; setStatus('testing'); try { const r = await testProvider({ ...p }); if (id !== reqId.current) return; setMsg(r); setStatus('ok'); } catch (e) { if (id !== reqId.current) return; setMsg(e instanceof Error ? e.message : String(e)); setStatus('fail'); } };
  const fetchModels = async () => {
    const id = ++reqId.current; setListing(true); setStatus('idle');
    try { const list = await listModels({ ...p }); if (id !== reqId.current) return; setModels(list); setMsg(`${list.length} model${list.length === 1 ? '' : 's'}`); if (list.length && !list.includes(p.model)) set({ model: list[0] }); setStatus('ok'); }
    catch (e) { if (id !== reqId.current) return; setMsg(e instanceof Error ? e.message : String(e)); setStatus('fail'); }
    if (id === reqId.current) setListing(false);
  };
  return (
    <div className="provider-form">
      <div className="pf-presets">{PROVIDER_PRESETS.map((pr) => <button key={pr.id} className={'filter' + (p.preset === pr.id ? ' on' : '')} onClick={() => pickPreset(pr.id)}>{pr.name}</button>)}</div>
      <div className="set-sub pf-hint">{preset.hint}</div>
      <div className="pf-grid">
        <label className="pf-field"><span>Base URL</span><input value={p.baseUrl} onChange={(e) => set({ baseUrl: e.target.value, preset: p.preset === 'custom' ? 'custom' : 'custom' })} placeholder="https://api.z.ai/api/coding/paas/v4" /></label>
        <label className="pf-field"><span>Model{models.length ? ` (${models.length} available)` : ''}</span>
          <input list="mesa-models" value={p.model} onChange={(e) => set({ model: e.target.value })} placeholder={preset.model || 'pick or type a model'} />
          <datalist id="mesa-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <label className="pf-field"><span>API key</span><input type="password" value={p.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-… / zai key" autoComplete="off" /></label>
      </div>
      <div className="pf-actions">
        <label className="tk-remember"><input type="checkbox" checked={p.proxy} onChange={(e) => set({ proxy: e.target.checked })} /> route via Mesa proxy (avoids CORS)</label>
        <label className="tk-remember" title={p.preset === 'strata' ? 'Strata (qwen3) hangs on tool definitions — keep this off there.' : 'Lets the model call present_html / bash / read_file'}><input type="checkbox" checked={toolsOn} onChange={(e) => set({ tools: e.target.checked })} /> tool calling</label>
        <span className="spacer" />
        <span className={'pf-status ' + status}>{status === 'testing' ? 'Testing…' : status === 'ok' ? `✓ ${msg}` : status === 'fail' ? `✗ ${msg}` : 'The key stays in this browser (localStorage).'}</span>
        <button className="btn sm ghost" onClick={fetchModels} disabled={!p.baseUrl || listing}>{listing ? 'Fetching…' : 'Fetch models'}</button>
        <button className="btn sm ghost" onClick={test} disabled={!p.baseUrl || !p.model || (!p.apiKey && p.preset !== 'mock') || status === 'testing'}>Test connection</button>
      </div>
    </div>
  );
}

function ShellRow() {
  const st = useStore();
  const [server, setServer] = useState<{ enabled: boolean; root?: string } | null>(null);
  useEffect(() => { shellStatus().then(setServer); }, []);
  const on = st.settings.shell && !!server?.enabled;
  return (
    <div className="set-row">
      <div><b>Real shell for live agents</b>
        <div className="set-sub">{server === null ? 'Checking server…' : server.enabled ? `Runs commands with ${shellName()} on this machine via serve.mjs, inside ${server.root ?? 'the repo'}. Every command still goes through the approval takeover.` : 'The server has the real shell disabled — set "shell": true in mesa.config.json (or MESA_SHELL=1) and restart serve.mjs. Live bash calls then use the simulated sandbox.'}</div>
      </div>
      <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} disabled={!server?.enabled} onClick={() => updateSettings({ shell: !st.settings.shell })}><i /></button>
    </div>
  );
}

export { PluginsPage } from './PluginsPage';

const AUTOS = [
  { id: 'a1', name: 'Nightly test run', rrule: 'Every weekday · 09:00 America/New_York', target: 'New session', last: 'today 09:00 · ok', on: true },
  { id: 'a2', name: 'Revenue refresh', rrule: 'Every Monday · 08:00 America/New_York', target: 'New session', last: 'Mon · ok', on: true },
  { id: 'a3', name: 'GitHub issue → PR', rrule: 'webhook · issues.opened', target: 'New session', last: 'never', on: false },
];
export { AutomationsPage } from './AutomationsPage';
