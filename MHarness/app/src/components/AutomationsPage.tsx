import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, Play, Trash2, Plus } from 'lucide-react';
import { useStore } from '../state/useStore';
import { removeAutomation, runAutomationNow, toggleAutomation, toast, upsertAutomation } from '../state/store';
import type { Id } from '../state/types';

const INTERVALS = [1, 5, 15, 30, 60, 180, 1440];

export function AutomationsPage() {
  const st = useStore();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [everyMin, setEveryMin] = useState(15);
  const [target, setTarget] = useState<string>('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const clock = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
  const inWords = (ms: number) => (ms <= 0 ? 'now' : ms < 60_000 ? `${Math.ceil(ms / 1000)}s` : ms < 3_600_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.round(ms / 3_600_000)}h`);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return toast('Give the automation a name and a prompt', 'warning');
    upsertAutomation({ name: name.trim(), prompt: prompt.trim(), everyMin, targetSessionId: (target || undefined) as Id | undefined, on: true });
    setName(''); setPrompt(''); setTarget('');
  };
  const autos = st.settings.automations;
  return (
    <div className="page">
      <div className="page-head"><CalendarClock size={16} /><b>Automations</b><span className="muted" style={{ fontSize: 11 }}>{autos.filter((a) => a.on).length} scheduled · runs while Mesa is open</span><span className="spacer" /></div>
      <div className="set-sub" style={{ margin: '4px 0 12px' }}>A prompt Mesa sends on a schedule — into a session of your choice or a fresh one each time. Each run streams like any other turn and shows up in the session list.</div>
      {autos.length === 0 && <div className="menu-empty">No automations yet — schedule one below.</div>}
      {autos.map((a) => {
        const targetTitle = a.targetSessionId ? st.sessions.find((s) => s.id === a.targetSessionId)?.title ?? 'missing session' : 'new session each run';
        return (
          <div key={a.id} className="automation">
            <span className={'rs ' + (a.on ? 'running' : 'exited')} />
            <div className="auto-main">
              <b>{a.name}</b>
              <div className="set-sub">every {a.everyMin >= 60 ? `${a.everyMin / 60} h` : `${a.everyMin} min`} → {targetTitle} · <i>{a.prompt}</i></div>
              <div className="auto-meta">
                <span className={'tag ' + (a.on ? 'ok' : '')}>{a.on ? `next in ${inWords((a.nextRunAt ?? 0) - now)} · ${clock(a.nextRunAt)}` : 'paused'}</span>
                <span className="muted">last run {a.lastRunAt ? clock(a.lastRunAt) : 'never'}</span>
                {a.lastSessionId && <a className="link-btn" href={`#/s/${a.lastSessionId}/artifacts`}>open run</a>}
              </div>
            </div>
            <button className="chip-btn" onClick={() => runAutomationNow(a.id)} title="Run now"><Play size={11} />Run now</button>
            <button className="switch" role="switch" aria-checked={a.on} onClick={() => toggleAutomation(a.id, !a.on)}><i /></button>
            <button className="icon-btn sm" title="Delete" onClick={() => removeAutomation(a.id)}><Trash2 size={13} /></button>
          </div>
        );
      })}
      <form className="auto-form" onSubmit={submit}>
        <div className="set-section-title">New automation</div>
        <div className="af-grid">
          <label className="pf-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning summary" /></label>
          <label className="pf-field"><span>Every</span><select value={everyMin} onChange={(e) => setEveryMin(Number(e.target.value))}>{INTERVALS.map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}</select></label>
          <label className="pf-field"><span>Target</span><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">New session each run</option>{st.sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        </div>
        <label className="pf-field"><span>Prompt</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Summarise what changed in the workspace and list anything that needs a decision" /></label>
        <div className="af-actions"><span className="spacer" /><button className="btn sm primary" type="submit"><Plus size={12} />Schedule</button></div>
      </form>
    </div>
  );
}
