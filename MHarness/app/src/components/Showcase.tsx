import { useEffect, useRef, useState } from 'react';
import { X, Pin, PinOff, ArrowRight, GitCompare, Play, Share2, Check, Sparkles, Minimize2, Maximize2, BellOff } from 'lucide-react';
import { dismissShowcase, getState, minimiseShowcase, openBesideChat, openPublish, pinArtifact, restoreFromTray, setDockTab, toast } from '../state/store';
import type { Artifact, Session, Turn } from '../state/types';
import { useStore } from '../state/useStore';
import { kindMeta, HtmlThumb } from './Dock';
import { notebookThumb } from './NotebookView';
import { Markdown } from './Markdown';

export function Showcase() {
  const st = useStore();
  const sc = st.showcase;
  const [focusIdx, setFocusIdx] = useState(0);
  const scRef = sc;
  useEffect(() => {
    if (!scRef || scRef.minimized) return;
    setFocusIdx(0);
    const onKey = (e: KeyboardEvent) => {
      const s = getState(); const cur = s.showcase; if (!cur || cur.minimized) return;
      const session = s.sessions.find((x) => x.id === cur.sessionId); const turn = session?.turns.find((t) => t.id === cur.turnId);
      const cards = (turn?.deliverables ?? []).map((id) => session?.artifacts.find((a) => a.id === id)).filter(Boolean) as Artifact[];
      if (!cards.length) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setFocusIdx((i) => (i + 1) % cards.length); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setFocusIdx((i) => (i - 1 + cards.length) % cards.length); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); const a = cards[Math.min(focusIdxRef.current, cards.length - 1)]; setDockTab(a.kind === 'code' ? 'files' : 'preview'); dismissShowcase(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [scRef?.sessionId, scRef?.turnId, !!scRef]);
  const focusIdxRef = useRef(0); focusIdxRef.current = focusIdx;
  if (!sc || sc.minimized) return null;
  const session = st.sessions.find((s) => s.id === sc.sessionId); const turn = session?.turns.find((t) => t.id === sc.turnId);
  if (!session || !turn) return null;
  const cards = turn.deliverables.map((id) => session.artifacts.find((a) => a.id === id)!).filter(Boolean);
  const allGreen = cards.every((c) => (c.verification?.tests ?? 'unknown') !== 'fail' && (c.verification?.preview ?? 'none') !== 'error');
  const secs = ((turn.endedAt ?? Date.now()) - turn.startedAt) / 1000;
  return (
    <div className={'showcase' + (sc.entering ? ' entering' : '') + (st.settings.effects && allGreen && cards.length >= 2 ? ' sweep' : '')} role="status" aria-live="polite" onPointerDown={() => { if (sc.entering) { /* interrupt */ } }}>
      <div className="showcase-head">
        <span className="sc-mark">✦</span>
        <div><b>{cards.length} deliverable{cards.length === 1 ? '' : 's'}</b><div className="sc-sub">turn · {secs.toFixed(0)}s · {turn.usage.outputTokens.toLocaleString()} out tokens · <kbd>←</kbd><kbd>→</kbd> choose · <kbd>Enter</kbd> open</div></div>
        <span className="spacer" />
        {allGreen && cards.length > 0 && <span className="sc-verified"><Check size={12} /> verified</span>}
        <button className="icon-btn sm" title="Pin all to Gallery" onClick={() => { cards.forEach((c) => !c.pinned && pinArtifact(session.id, c.id)); toast('Pinned all to Gallery', 'success'); }}><Pin size={14} /></button>
        <button className="icon-btn sm" title="Minimise to tray" onClick={minimiseShowcase}><Minimize2 size={14} /></button>
        <button className="icon-btn sm" title="Dismiss (Esc)" onClick={dismissShowcase}><X size={14} /></button>
      </div>
      <div className="showcase-cards">
        {cards.map((c, i) => <ShowcaseCard key={c.id} a={c} session={session} i={i} focused={i === focusIdx} />)}
      </div>
      <div className="showcase-verify">
        <span className="sv-label"><Sparkles size={12} /> Verify all</span>
        <button className="chip-btn" onClick={() => setDockTab('files')}><GitCompare size={11} />diff</button>
        <button className="chip-btn" onClick={() => setDockTab('preview')}><Play size={11} />preview</button>
        <button className="chip-btn" onClick={() => setDockTab('run')}>tests</button>
        <span className="spacer" />
        <button className="chip-btn" onClick={() => { setDockTab('artifacts'); dismissShowcase(); }}>Open in dock <ArrowRight size={11} /></button>
      </div>
      <div className="showcase-glow" aria-hidden />
    </div>
  );
}

function ShowcaseCard({ a, session, i, focused }: { a: Artifact; session: Session; i: number; focused: boolean }) {
  const meta = kindMeta(a.kind);
  const v = a.verification;
  return (
    <div className={'sc-card' + (focused ? ' focused' : '')} style={{ animationDelay: `${i * 60}ms` }}>
      <div className="sc-thumb">
        {a.kind === 'app' || a.kind === 'html' ? <div className="thumb-live"><HtmlThumb html={a.html ?? ''} scale={0.62} /></div> : a.kind === 'chart' && a.chart ? <MiniChart a={a} /> : a.notebook ? <pre className="thumb-code">{notebookThumb(a.notebook)}</pre> : a.code ? <pre className="thumb-code">{a.code.split('\n').slice(0, 8).join('\n')}</pre> : <div className="thumb-blank" />}
        <span className={'kind-badge ' + meta.cls}>{meta.label}</span>
      </div>
      <div className="sc-body">
        <div className="sc-title">{a.title}</div>
        <div className="sc-stats">
          {a.added !== undefined && <span className="add">+{a.added}</span>}{a.removed ? <span className="del">−{a.removed}</span> : null}
          {a.lines ? <span>{a.lines} lines</span> : null}{a.bytes ? <span>{(a.bytes / 1024).toFixed(1)} kB</span> : null}
          {v?.tests === 'pass' && <span className="v ok"><Check size={10} /> tests pass</span>}{v?.tests === 'fail' && <span className="v bad">✗ tests fail</span>}
          {v?.preview === 'ready' && <span className="v ok">preview ready</span>}
          {a.kind === 'chart' && <span className="v">re-runnable</span>}
        </div>
        <div className="sc-actions">
          <button className="btn sm primary" onClick={() => setDockTab(a.kind === 'code' ? 'files' : 'preview')}>Open</button>
          {(a.html || a.kind === 'chart' || a.notebook) && <button className="btn sm ghost" title="Show it live beside the conversation" onClick={() => { openBesideChat(session.id, a.id); dismissShowcase(); }}>⫶ Beside chat</button>}
          {a.added !== undefined && <button className="btn sm ghost" onClick={() => setDockTab('files')}><GitCompare size={12} />Compare</button>}
          {(a.kind === 'app' || a.kind === 'chart') && <button className="btn sm ghost" onClick={() => { setDockTab('preview'); toast(`Re-running ${a.title} with the same inputs`, 'info'); }}><Play size={12} />{a.kind === 'chart' ? 'Re-run' : 'Run'}</button>}
          <button className="icon-btn sm" title="Share / publish" onClick={() => a.html ? openPublish(session.id, a.id) : toast('Publishing is for HTML artifacts — use Pin to keep this one in the Gallery', 'info')}><Share2 size={13} /></button>
          <button className={'icon-btn sm' + (a.pinned ? ' on' : '')} title="Pin to Gallery" onClick={() => pinArtifact(session.id, a.id)}>{a.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
        </div>
      </div>
    </div>
  );
}

function MiniChart({ a }: { a: Artifact }) {
  const ch = a.chart!; const max = Math.max(...ch.values);
  return <div className="thumb-chart mini"><div className="tc-title">{ch.title}</div><div className="tc-bars">{ch.values.map((v, i) => <div key={i} className="tc-b" style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 50}ms` }} />)}</div></div>;
}

export function DndBanner({ session, turn }: { session: Session; turn: Turn }) {
  const n = turn.deliverables.length;
  return <button className="dnd-chip" onClick={() => { const t = restoreFromTray; t; }}><BellOff size={12} />{n} deliverables docked to Gallery</button>;
}

export function TrayStack() {
  const st = useStore();
  if (!st.tray.length) return null;
  return (
    <div className="tray" aria-label="Minimised windows">
      {st.tray.map((t) => <button key={t.id} className="tray-item" onClick={() => restoreFromTray(t.id)} title={t.subtitle}><Maximize2 size={12} /><span>{t.title}</span></button>)}
    </div>
  );
}
