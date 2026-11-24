import { sc } from '../state/platform';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowUpToLine, CornerDownLeft, Paperclip, AtSign, Slash, X, ShieldAlert, ShieldCheck, CircleStop, ListChecks, Check, ChevronDown, Sparkles, AlertTriangle, Clock } from 'lucide-react';
import { cancelTurn, clearInsert, decide, dequeue, flushQueue, send, setDockTab, toast, togglePalette } from '../state/store';
import { useStore } from '../state/useStore';
import type { Approval, Session } from '../state/types';

const SLASH = [
  { cmd: '/plan', desc: 'Switch to Plan mode (review before run)' },
  { cmd: '/build', desc: 'Switch to Build mode' },
  { cmd: '/auto', desc: 'Switch to Auto mode (approvals for risky only)' },
  { cmd: '/clear', desc: 'Start a new session' },
  { cmd: '/export', desc: 'Export this session (JSONL · ZIP · MD)' },
  { cmd: '/share', desc: 'Share the latest deliverables' },
];
const FILES = ['mesa-demo/src/App.tsx', 'mesa-demo/src/styles.css', 'mesa-demo/src/lib/stats.ts', 'mesa-demo/data/revenue.csv', 'mesa-demo/tests/chart.test.ts'];

export function Composer({ session }: { session: Session }) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState<'slash' | 'file' | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = session.state === 'running' || session.state === 'awaiting';
  const plan = session.plan;
  const ins = useStore().insert;
  useEffect(() => { if (ins) { setText((t) => t + ins.text); ta.current?.focus(); clearInsert(); } }, [ins]);

  useEffect(() => {
    const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(220, el.scrollHeight) + 'px';
  }, [text]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const s = document.querySelector('.suggest button') as HTMLButtonElement | null; if (!live && s && session.turns.length === 0) s.click(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [live, session.turns.length]);

  const onChange = (v: string) => {
    setText(v);
    const last = v.split(/\s/).pop() ?? '';
    if (v.startsWith('/') && !v.includes(' ')) setMenu('slash'); else if (last.startsWith('@')) setMenu('file'); else setMenu(null);
  };
  const submit = (mode?: 'queue' | 'inject') => {
    const t = text.trim(); if (!t) return;
    if (t.startsWith('/')) { runSlash(t); setText(''); return; }
    send(t, { mode }); setText(''); setMenu(null);
  };
  const runSlash = (t: string) => {
    const m = t.split(/\s+/)[0];
    if (m === '/plan' || m === '/build' || m === '/auto') import('../state/store').then((s) => s.setMode(session.id, m.slice(1) as 'plan' | 'build' | 'auto'));
    else if (m === '/clear') import('../state/store').then((s) => s.newSessionAction());
    else if (m === '/export') import('../state/store').then((s) => s.toast('Export queued — JSONL written to exports/', 'success'));
    else if (m === '/share') { setDockTab('artifacts'); import('../state/store').then((s) => s.toast('Pick a deliverable and press Share', 'info')); }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); submit(); }
    else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); if (live) submit('inject'); else setText(text + '\n'); }
    else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); submit('queue'); }
    else if (e.key === 'Escape') setMenu(null);
  };
  const lastWord = text.split(/\s/).pop() ?? '';
  const filteredSlash = SLASH.filter((s) => s.cmd.startsWith(text.split(' ')[0]));
  const filteredFiles = FILES.filter((f) => lastWord.length <= 1 || f.toLowerCase().includes(lastWord.slice(1).toLowerCase()));

  return (
    <div className="composer-stack">
      {plan && <PlanCard session={session} />}
      {session.queued.length > 0 && (
        <div className="queued">
          {session.queued.map((q) => (
            <div key={q.id} className="queued-item"><span className="queued-mode">{q.mode === 'inject' ? 'inject at next tool call' : 'sends when turn ends'}</span><span className="queued-text">{q.text}</span><button className="icon-btn sm" onClick={() => dequeue(session.id, q.id)} title="Remove"><X size={12} /></button></div>
          ))}
          {!live && <button className="chip-btn" onClick={() => flushQueue(session.id)}>Send queued now</button>}
        </div>
      )}
      {session.pendingApproval ? <ApprovalTakeover session={session} approval={session.pendingApproval} draft={text} /> : (
        <div className={'composer' + (menu ? ' has-menu' : '')}>
          {menu === 'slash' && <div className="composer-menu">{filteredSlash.map((s) => <button key={s.cmd} onClick={() => { setText(s.cmd + ' '); setMenu(null); ta.current?.focus(); }}><b>{s.cmd}</b><span>{s.desc}</span></button>)}</div>}
          {menu === 'file' && <div className="composer-menu">{filteredFiles.length ? filteredFiles.map((f) => <button key={f} onClick={() => { setText(text.slice(0, text.length - lastWord.length) + '@' + f + ' '); setMenu(null); ta.current?.focus(); }}><AtSign size={12} /><span>{f}</span></button>) : <div className="menu-empty">No matching files</div>}</div>}
          <div className="composer-toolbar">
            <button className="icon-btn" title="Attach file" onClick={() => fileInput.current?.click()}><Paperclip size={15} /></button>
            <input ref={fileInput} type="file" multiple hidden aria-label="Attach files" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) { const names = files.map((f) => '@' + f.name).join(' '); setText((t) => (t ? t + ' ' : '') + names + ' '); toast(`Attached ${files.length} file${files.length === 1 ? '' : 's'}`, 'success'); } e.target.value = ''; }} />
            <button className="icon-btn" title="Reference a file with @" onClick={() => { setText(text + '@'); ta.current?.focus(); }}><AtSign size={15} /></button>
            <button className="icon-btn" title="Slash command" onClick={() => { setText('/'); ta.current?.focus(); }}><Slash size={15} /></button>
            <button className="icon-btn" data-key="K" title="Commands (Ctrl+K)" onClick={() => togglePalette(true)}><Sparkles size={15} /></button>
            <span className="composer-hint"><kbd>Enter</kbd> send · <kbd>{sc('Shift')}</kbd><kbd>Enter</kbd> {live ? 'inject' : 'newline'}{live && <> · <kbd>{sc('Alt')}</kbd><kbd>Enter</kbd> queue</>}</span>
          </div>
          <textarea ref={ta} className="composer-input" rows={1} placeholder={live ? 'Steer the agent — queue a message or inject at the next tool call…' : 'Ask Mesa to build, analyse, fix or refactor…'} value={text} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} aria-label="Message" />
          <div className="composer-bottom">
            <span className={'preset-indicator p-' + session.preset}><ShieldCheck size={12} />{session.preset === 'full-access' ? 'Full access' : session.preset === 'read-only' ? 'Read-only' : 'Workspace write'}</span>
            <span className="composer-spacer" />
            {live && <button className="btn ghost" onClick={() => cancelTurn(session.id)} title="Cancel turn"><CircleStop size={14} />Stop</button>}
            {live ? (
              <>
                <button className="btn ghost" onClick={() => submit('queue')} disabled={!text.trim()} title="Queue (Alt+Enter)"><Clock size={14} />Queue</button>
                <button className="btn primary" onClick={() => submit('inject')} disabled={!text.trim()} title="Inject at next tool call (Shift+Enter)"><CornerDownLeft size={14} />Inject</button>
              </>
            ) : (
              <button className="btn primary send" onClick={() => submit()} disabled={!text.trim()} title="Send (Enter)"><ArrowUp size={16} /></button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({ session }: { session: Session }) {
  const [open, setOpen] = useState(session.state === 'running');
  const done = session.plan!.items.filter((i) => i.state === 'done').length;
  return (
    <div className="plan-card">
      <button className="plan-head" onClick={() => setOpen(!open)}><ListChecks size={14} /><span>Plan</span><div className="plan-progress"><div style={{ width: `${(done / session.plan!.items.length) * 100}%` }} /></div><span className="plan-n">{done}/{session.plan!.items.length}</span><ChevronDown size={12} className={open ? '' : 'closed'} /></button>
      {open && <ol className="plan-items">{session.plan!.items.map((it) => <li key={it.text} className={'plan-' + it.state}>{it.state === 'done' ? <Check size={12} /> : it.state === 'doing' ? <span className="mini-spin" /> : <span className="mini-dot" />}<span>{it.text}</span></li>)}</ol>}
    </div>
  );
}

export function ApprovalTakeover({ session, approval, draft }: { session: Session; approval: Approval; draft: string }) {
  const [reason, setReason] = useState('');
  const [deny, setDeny] = useState(false);
  const [remember, setRemember] = useState(false);
  const risk = approval.risk;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyA') { e.preventDefault(); decide(session.id, { action: 'allow-once' }); }
      if (e.altKey && e.code === 'KeyR') { e.preventDefault(); setDeny(true); }
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (deny) decide(session.id, { action: 'deny', reason: reason.trim() || 'dismissed by user' }); else setDeny(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [session.id, deny, reason]);
  const allow = () => decide(session.id, remember ? { action: 'allow-always' } : { action: 'allow-once' });
  return (
    <div className={'takeover' + (deny ? ' deny' : '')} role="dialog" aria-labelledby="ap-title">
      <div className="takeover-head"><ShieldAlert size={16} /><div><div id="ap-title" className="tk-title">{approval.title}</div><div className="tk-sub">{approval.kind} · requested {Math.round((Date.now() - approval.requestedAt) / 1000)}s ago</div></div><span className={'risk r-' + (risk?.level ?? 'medium')}>{risk?.level ?? 'medium'} risk</span></div>
      <pre className="tk-detail">{highlight(approval.detail, approval.flags)}</pre>
      {risk?.rationale && <div className="tk-rationale"><Sparkles size={12} /> auto-review: {risk.rationale}</div>}
      {draft && <div className="tk-draft">Draft saved: “{draft.slice(0, 60)}{draft.length > 60 ? '…' : ''}”</div>}
      {deny ? (
        <div className="tk-deny"><input autoFocus placeholder="Why? (sent to the agent)" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') decide(session.id, { action: 'deny', reason }); }} /><button className="btn ghost" onClick={() => setDeny(false)}>Back</button><button className="btn danger" onClick={() => decide(session.id, { action: 'deny', reason })}>Deny</button></div>
      ) : (
        <div className="tk-actions">
          <label className="tk-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> always allow for this repo</label>
          <span className="composer-spacer" />
          <button className="btn ghost" onClick={() => setDeny(true)} title="Deny with reason (Alt+R)"><X size={14} />Deny</button>
          <button className="btn primary" onClick={allow} autoFocus title="Allow (Alt+A)"><ShieldCheck size={14} />{remember ? 'Always allow' : 'Allow once'}</button>
        </div>
      )}
      <div className="tk-hint"><AlertTriangle size={11} /> Agent is paused until you decide. <kbd>{sc('Alt')}</kbd><kbd>A</kbd> allow · <kbd>{sc('Alt')}</kbd><kbd>R</kbd> deny <span className="spacer" /><button className="link-btn" onClick={() => cancelTurn(session.id)}>Cancel turn</button></div>
    </div>
  );
}

function highlight(text: string, flags: string[]) {
  const parts = text.split(/(\s+)/);
  return parts.map((p, i) => flags.some((f) => p.includes(f.split(' ')[0])) && p.length > 2 ? <mark key={i} className="flag">{p}</mark> : <span key={i}>{p}</span>);
}
