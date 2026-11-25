import { sc } from '../state/platform';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Zap, Target, Activity, Check, PanelRight, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { DOCK_TABS, killRun, restartRun, presetLabel, setDockTab, setMode, setModel, setPreset, toggleDock } from '../state/store';
import type { Mode, Preset, Session } from '../state/types';
import { useStore } from '../state/useStore';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'plan', label: 'Plan', hint: 'Agent plans first; you review before anything runs.' },
  { id: 'build', label: 'Build', hint: 'Agent edits and runs inside the workspace preset.' },
  { id: 'auto', label: 'Auto', hint: 'Agent runs to completion; approvals only for risky actions.' },
];
const PRESETS: { id: Preset; label: string; icon: typeof ShieldCheck; hint: string }[] = [
  { id: 'read-only', label: 'Read-only', icon: ShieldOff, hint: 'No writes, no network. Asks for everything.' },
  { id: 'workspace-write', label: 'Workspace write', icon: ShieldCheck, hint: 'Writes inside the workspace; asks outside it.' },
  { id: 'full-access', label: 'Full access', icon: ShieldAlert, hint: 'No sandbox. Asks only for dangerous commands.' },
];
const MODELS = ['mesa-1-pro', 'mesa-1-flash', 'claude-sonnet-4-5', 'gpt-5-codex', 'glm-4.6'];

export function Header({ session }: { session: Session }) {
  const st = useStore();
  const [menu, setMenu] = useState<'mode' | 'model' | 'preset' | 'jobs' | null>(null);
  const runningJobs = session.runs.filter((r) => r.status === 'running');
  const pct = session.tokens / session.contextMax;
  // Live throughput: smoothed tokens/second while the active turn is streaming (chars/4 ≈ tokens).
  const liveTurn = session.state === 'running' ? session.turns.find((t) => t.status === 'running') : undefined;
  const liveLen = liveTurn ? liveTurn.blocks.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0) : -1;
  const rateRef = useRef<{ len: number; at: number; rate: number }>({ len: -1, at: 0, rate: 0 });
  const [, bump] = useState(0);
  useEffect(() => { const r = rateRef.current; if (liveLen < 0) { rateRef.current = { len: -1, at: 0, rate: 0 }; return; } const now = Date.now(); if (r.len < 0) { r.len = liveLen; r.at = now; return; } const dt = (now - r.at) / 1000; if (dt >= 0.4) { r.rate = r.rate * 0.4 + ((liveLen - r.len) / 4 / dt) * 0.6; r.len = liveLen; r.at = now; bump((x) => x + 1); } }, [liveLen]);
  const preset = PRESETS.find((p) => p.id === session.preset)!;
  const PresetIcon = preset.icon;
  return (
    <header className="hdr" onClick={() => menu && setMenu(null)}>
      <div className="hdr-left">
        <button data-key="." className={'pill pill-mode mode-' + session.mode} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'mode' ? null : 'mode'); }} title={`Toggle mode (${sc('Ctrl+.')})`}><span className="pill-dot" />{MODES.find((m) => m.id === session.mode)?.label}<ChevronDown size={12} /></button>
        <button data-key={sc('Shift+P')} className={'pill pill-preset preset-' + session.preset} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'preset' ? null : 'preset'); }} title={`Permission preset (${sc('Ctrl+Shift+P')})`}><PresetIcon size={13} />{presetLabel(session.preset)}</button>
        {menu === 'mode' && (
          <div className="menu" onClick={(e) => e.stopPropagation()}>
            {MODES.map((m) => <button key={m.id} className={'menu-item' + (m.id === session.mode ? ' on' : '')} onClick={() => { setMode(session.id, m.id); setMenu(null); }}><div><b>{m.label}</b><div className="menu-sub">{m.hint}</div></div>{m.id === session.mode && <Check size={14} />}</button>)}
          </div>
        )}
        {menu === 'preset' && (
          <div className="menu" onClick={(e) => e.stopPropagation()}>
            {PRESETS.map((p) => <button key={p.id} className={'menu-item' + (p.id === session.preset ? ' on' : '')} onClick={() => { setPreset(session.id, p.id); setMenu(null); }}><div><b>{p.label}</b><div className="menu-sub">{p.hint}</div></div>{p.id === session.preset && <Check size={14} />}</button>)}
          </div>
        )}
      </div>
      <div className="hdr-center">
        {session.goal && <div className={'goal' + (session.goal.status === 'complete' ? ' complete' : '')} title={session.goal.text}><Target size={14} /><span className="goal-text">{session.goal.text}</span><div className="goal-bar"><div className="goal-fill" style={{ width: `${(session.goal.done / Math.max(1, session.goal.total)) * 100}%` }} /></div><span className="goal-n">{session.goal.done}/{session.goal.total}</span></div>}
      </div>
      <div className="hdr-right">
        <button className={'pill pill-model' + (menu === 'model' ? ' open' : '')} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'model' ? null : 'model'); }} title="Model"><Activity size={13} />{session.model}<ChevronDown size={12} /></button>
        {menu === 'model' && <div className="menu menu-right" onClick={(e) => e.stopPropagation()}>{MODELS.map((m) => <button key={m} className={'menu-item' + (m === session.model ? ' on' : '')} onClick={() => { setModel(session.id, m); setMenu(null); }}><div><b>{m}</b><div className="menu-sub">{m.includes('flash') ? 'fast · cheap' : m.includes('codex') ? 'code-tuned' : 'balanced'}</div></div>{m === session.model && <Check size={14} />}</button>)}</div>}
        <div className={'tokenmeter' + (liveLen >= 0 ? ' pulse' : '')} title={`Context ${session.tokens.toLocaleString()} / ${session.contextMax.toLocaleString()} tokens · cache ${(session.cacheHit * 100).toFixed(0)} %`}>
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden><circle cx="13" cy="13" r="10" className="tm-bg" /><circle cx="13" cy="13" r="10" className={'tm-fg' + (pct > 0.8 ? ' warn' : '')} strokeDasharray={`${pct * 62.8} 62.8`} transform="rotate(-90 13 13)" /></svg>
          <span className="tm-label">{pct > 0.8 ? 'Compact soon' : `${Math.round(pct * 100)} %`}</span>
          {liveLen >= 0 && rateRef.current.rate > 1 && <span className="tm-rate" title="Streaming throughput (approximate)">{Math.round(rateRef.current.rate)} tok/s</span>}
        </div>
        <button className={'pill pill-jobs' + (runningJobs.length ? ' live' : '')} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'jobs' ? null : 'jobs'); setDockTab('run'); }} title="Background jobs"><Zap size={13} />{runningJobs.length ? runningJobs.length : 'No jobs'}</button>
        {menu === 'jobs' && runningJobs.length > 0 && (
          <div className="menu menu-right" onClick={(e) => e.stopPropagation()}>
            {runningJobs.map((r) => <div key={r.id} className="menu-item job-item"><div><b>{r.command}</b><div className="menu-sub">{r.runtime} · {r.cwd}{r.port ? ` · :${r.port}` : ''}</div></div><button className="chip-btn" onClick={() => restartRun(session.id, r.id)}>Restart</button><button className="chip-btn danger" onClick={() => killRun(session.id, r.id)}>Kill</button></div>)}
          </div>
        )}
        <button className="icon-btn" data-key={sc('Shift+\\')} title="Toggle right dock (Ctrl+Shift+\)" onClick={toggleDock}><PanelRight size={15} /></button>
      </div>
    </header>
  );
}

export function DockTabs() {
  const st = useStore();
  return (
    <div className="dock-tabs" role="tablist">
      {DOCK_TABS.map((t) => (
        <button key={t.id} role="tab" data-key={t.key} aria-selected={st.dock.tab === t.id} className={'dock-tab' + (st.dock.tab === t.id ? ' on' : '')} onClick={() => setDockTab(t.id)} title={`${t.label} (${sc('Ctrl+' + t.key)})`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
