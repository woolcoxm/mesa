import { sc } from '../state/platform';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, Pencil, Terminal as TerminalIcon, Eye, Globe, Search, Brain, Cpu, Play, Check, X, Loader2, Clock,
  ChevronRight, ChevronDown, Image as ImageIcon, Sparkles, GitBranch, Database, Wand2, RotateCcw, Copy,
} from 'lucide-react';
import { Markdown } from './Markdown';
import { insertIntoComposer, isAcpAgent, isLiveAgent, openAdhocPreview, selectRun, send, setDockTab, toast } from '../state/store';
import type { Block, DiffInfo, Session, ToolCall, Turn } from '../state/types';
import { useStore } from '../state/useStore';

const ICONS: Record<string, typeof FileText> = { read: FileText, edit: Pencil, write: Pencil, bash: TerminalIcon, python: Cpu, preview: Eye, browser: Globe, grep: Search, grep_search: Search, search: Search, skill: Sparkles, subagent: GitBranch, sql: Database, python_exec: Cpu, generate: Wand2, read_image: ImageIcon };
const STATUS_ICON: Record<ToolCall['status'], typeof Check> = { queued: Clock, running: Loader2, 'awaiting-approval': Clock, success: Check, error: X, denied: X };

export function Thread({ session }: { session: Session }) {
  if ((window as unknown as { __mesaCrashThread?: boolean }).__mesaCrashThread) throw new Error('Debug crash requested from the palette');
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [jumpCount, setJumpCount] = useState(0);
  const lastLen = useRef(session.turns.length);
  const focus = useStore().focus;
  useEffect(() => {
    if (!focus) return;
    const el = ref.current?.querySelector('[data-call-id="' + focus.callId + '"]');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); const t = setTimeout(() => el.classList.remove('flash'), 1800); return () => clearTimeout(t); }
  }, [focus]);

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (pinned.current) el.scrollTop = el.scrollHeight;
    else if (session.state === 'running') { setShowJump(true); }
  });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => { const near = el.scrollHeight - el.scrollTop - el.clientHeight < 200; pinned.current = near; if (near) setShowJump(false); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { if (session.turns.length !== lastLen.current) { lastLen.current = session.turns.length; pinned.current = true; setShowJump(false); const el = ref.current; if (el) el.scrollTop = el.scrollHeight; } }, [session.turns.length]);

  return (
    <div className="thread-wrap">
      <div ref={ref} className="thread" role="log" aria-live="polite" aria-busy={session.state === 'running'}>
        <div className="thread-inner">
          {session.turns.length === 0 && <EmptyThread />}
          {session.turns.map((t, i) => <TurnCard key={t.id} turn={t} session={session} first={i === 0} />)}
        </div>
      </div>
      {showJump && <button className="jump" onClick={() => { pinned.current = true; setShowJump(false); const el = ref.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }}>↓ Jump to latest{jumpCount ? ` (${jumpCount})` : ''}</button>}
    </div>
  );
}

type Suggestion = [icon: string, label: string, prompt: string];
const DEMO_SUGGESTIONS: Suggestion[] = [
  ['⚡', 'Build a small flashy dashboard app', 'Build a small flashy dashboard app with Vite'],
  ['📈', 'Analyse the revenue data and make a chart', 'Analyse the revenue data and make a chart'],
  ['🧪', 'Run the tests and fix whatever fails', 'Run the tests and fix whatever fails'],
  ['🔁', 'Rename Series → TimeSeries across the repo', 'Refactor: rename Series to TimeSeries across the repo'],
];
const LIVE_SUGGESTIONS: Suggestion[] = [
  ['⚡', 'Build a glowing click-counter page', 'Build a tiny self-contained HTML page with one big glowing button that counts clicks. Include a <title>.'],
  ['📊', 'Make a bar chart from sample data', 'Make a self-contained HTML page with a bar chart of monthly revenue (Jan 182k, Feb 201k, Mar 198k, Apr 244k, May 262k, Jun 299k, Jul 331k). Include a <title>.'],
  ['🎨', 'Design a landing page hero', 'Design a dark, minimal landing-page hero for an AI agent harness called Mesa, with a gradient headline and one call-to-action button. Self-contained HTML with a <title>.'],
  ['🧠', 'Explain a concept with a diagram', 'Explain how an event-sourced session ledger works, and include a small self-contained HTML diagram (boxes and arrows) illustrating it.'],
];
function EmptyThread() {
  const st = useStore();
  const live = isLiveAgent() || isAcpAgent();
  return (
    <div className="empty-thread">
      <div className="hero-mark"><span className="hero-dot" />Mesa</div>
      <div className="hero-agent">{isAcpAgent() ? 'acp · external agent over the Agent Client Protocol' : live ? `live · ${st.settings.provider?.model}${st.settings.provider?.preset === 'strata' ? ' via Strata' : ''}` : 'demo agent · scripted scenarios, no network'}</div>
      <h2>Where your agent works in the open.</h2>
      <p>Ask for something that produces a thing — an app, a chart, a fix — and it shows up on the right as a deliverable you can <b>open</b>, <b>run</b>, <b>compare</b> and <b>share</b>.</p>
      <div className="suggest">
        {(live ? LIVE_SUGGESTIONS : DEMO_SUGGESTIONS).map(([icon, label, prompt]) => (
          <button key={label} onClick={() => send(prompt)}>{icon} {label}</button>
        ))}
      </div>
      <div className="kbd-hints"><kbd>{sc('Ctrl')}</kbd><kbd>K</kbd> commands · <kbd>{sc('Ctrl')}</kbd><kbd>Enter</kbd> send · <kbd>{sc('Shift')}</kbd><kbd>Enter</kbd> inject · <kbd>{sc('Alt')}</kbd><kbd>A</kbd> approve</div>
    </div>
  );
}

function TurnCard({ turn, session, first }: { turn: Turn; session: Session; first: boolean }) {
  const [open, setOpen] = useState(true);
  const live = turn.status === 'running' || turn.status === 'awaiting';
  const toolCount = turn.blocks.filter((b) => b.type === 'tool').length;
  const secs = ((turn.endedAt ?? Date.now()) - turn.startedAt) / 1000;
  return (
    <div className={'turn' + (live ? ' live' : '')}>
      <div className="user-bubble"><div className="user-avatar">you</div><div className="user-text">{turn.user}</div></div>
      <div className="agent-row">
        <div className="agent-avatar"><span className={live ? 'agent-mark pulse' : 'agent-mark'}>M</span></div>
        <div className="agent-body">
          {turn.thinking && <Thinking text={turn.thinking} live={live} />}
          {!first && toolCount > 2 && !live && (
            <button className="turn-summary" onClick={() => setOpen(!open)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {toolCount} tool calls · {turn.deliverables.length} deliverables · {secs.toFixed(1)}s</button>
          )}
          {(open || live || toolCount <= 2) && turn.blocks.map((b) => <BlockView key={b.id} b={b} session={session} />)}
          {live && <Working turn={turn} session={session} />}
          {turn.status === 'cancelled' && <div className="turn-note">Turn cancelled.</div>}
          {turn.status === 'done' && (
            <div className="turn-actions">
              <button className="chip-btn" title="Run the same prompt again as a new turn" disabled={session.state !== 'idle'} onClick={() => send(turn.user)}><RotateCcw size={11} />Retry</button>
              <button className="chip-btn" title="Put this message back in the composer" onClick={() => insertIntoComposer(turn.user)}><Pencil size={11} />Edit</button>
              {(() => { const md = turn.blocks.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('\n\n').trim(); return md ? <button className="chip-btn" title="Copy the answer as Markdown" onClick={async () => { try { await navigator.clipboard.writeText(md); toast('Answer copied as Markdown', 'success'); } catch { toast('Clipboard unavailable', 'warning'); } }}><Copy size={11} />Copy</button> : null; })()}
              <span className="turn-meta">{turn.deliverables.length ? `${turn.deliverables.length} deliverable${turn.deliverables.length === 1 ? '' : 's'} · ` : ''}{(secs).toFixed(0)}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PHRASES = ['thinking', 'reading the workspace', 'planning the next step', 'checking the diff', 'writing', 'verifying'];
function Working({ turn, session }: { turn: Turn; session: Session }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => x + 1), 1700); return () => clearInterval(t); }, []);
  const running = [...turn.blocks].reverse().find((b) => b.type === 'tool' && (b.call.status === 'running' || b.call.status === 'awaiting-approval'));
  const label = session.state === 'awaiting' ? 'waiting for your approval' : running && running.type === 'tool' ? `${running.call.name} · ${running.call.title}` : PHRASES[i % PHRASES.length];
  return <div className="working"><span className="dots"><i /><i /><i /></span><span className="working-label" key={label}>{label}<span className="ellipsis" /></span></div>;
}

function Thinking({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'thinking' + (open ? ' open' : '')}>
      <button className="thinking-head" onClick={() => setOpen(!open)}>{live ? <Loader2 size={12} className="spin" /> : <Brain size={12} />}<span>Thought for a moment</span><ChevronRight size={12} className="chev" /></button>
      {open && <div className="thinking-body">{text}</div>}
    </div>
  );
}

function BlockView({ b, session }: { b: Block; session: Session }) {
  if (b.type === 'text') {
    if (!b.text.trim()) return b.streaming ? <div className="answer streaming-caret">▍</div> : null;
    return (
      <div className="answer">
        <Markdown
          text={b.text}
          streaming={b.streaming}
          onRun={(lang, code) => {
            if (/^svg$/i.test(lang)) openAdhocPreview('SVG block', `<!doctype html><html><body style="margin:0;background:var(--mesa-bg-surface);display:grid;place-items:center;height:100vh">${code}</body></html>`);
            else openAdhocPreview(`${lang.toUpperCase()} block`, code);
            toast('Running in the Preview pane', 'info');
          }}
        />
      </div>
    );
  }
  return <ToolRow call={b.call} session={session} />;
}

export function DiffChip({ diff, onOpen }: { diff: DiffInfo; onOpen?: () => void }) {
  const [peek, setPeek] = useState(false);
  const timer = useRef<number | null>(null);
  return (
    <span className="diffchip-wrap" onMouseEnter={() => { timer.current = window.setTimeout(() => setPeek(true), 300); }} onMouseLeave={() => { if (timer.current) clearTimeout(timer.current); setPeek(false); }}>
      <button className="diffchip" onClick={onOpen ?? (() => setDockTab('files'))} title={diff.file}><span className="add">+{diff.added}</span><span className="del">−{diff.removed}</span></button>
      {peek && (
        <div className="peek" role="tooltip">
          <div className="peek-head">{diff.file}</div>
          <pre className="peek-diff">{diff.hunks.flatMap((h) => [...h.oldLines.map((l) => ({ l, k: '-' as const })), ...h.newLines.map((l) => ({ l, k: '+' as const }))]).slice(0, 14).map((x, i) => <div key={i} className={'dl ' + x.k}>{x.k} {x.l}</div>)}</pre>
        </div>
      )}
    </span>
  );
}

function ToolRow({ call, session }: { call: ToolCall; session: Session }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[call.name] ?? Sparkles;
  const StatusIcon = STATUS_ICON[call.status];
  const hasOutput = !!(call.output && call.output.trim());
  const run = call.runId ? session.runs.find((r) => r.id === call.runId) : undefined;
  const statusCls = call.status === 'error' || call.status === 'denied' ? 'bad' : call.status === 'success' ? 'ok' : call.status === 'awaiting-approval' ? 'wait' : 'run';
  return (
    <div className={'toolrow st-' + call.status} data-call-id={call.id}>
      <div className="toolrow-main">
        <span className="tool-icon"><Icon size={13} /></span>
        <span className="tool-name">{call.name}</span>
        <span className="tool-title">{call.title}</span>
        {call.subtitle && <span className="tool-sub">{call.subtitle}</span>}
        {call.diff && <DiffChip diff={call.diff} />}
        {call.runtime && <span className="tag">{call.runtime}</span>}
        {call.decision?.action === 'deny' && <span className="tag bad">denied</span>}
        <span className="tool-spacer" />
        {call.status === 'running' && call.stream && run && <span className="tool-live"><i /><i /><i /></span>}
        {hasOutput && <button className="icon-btn sm" onClick={() => setOpen(!open)} title="Toggle output">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>}
        {run && <button className="chip-btn" onClick={() => { selectRun(session.id, run.id); setDockTab('run'); }} title="Open in Run console"><TerminalIcon size={11} /> console</button>}
        <span className={'tool-status ' + statusCls}><StatusIcon size={12} className={call.status === 'running' ? 'spin' : ''} />{call.ms ? `${(call.ms / 1000).toFixed(1)}s` : call.status === 'awaiting-approval' ? 'approval' : call.status === 'running' ? '' : call.status}</span>
      </div>
      {call.error && <div className="tool-error">{call.error}</div>}
      {open && call.output && <pre className="tool-output">{call.output.length > 4000 ? call.output.slice(0, 4000) + '\n… (truncated)' : call.output}</pre>}
    </div>
  );
}

export function StatusLine({ session }: { session: Session }) {
  const n = useMemo(() => session.turns.filter((t) => t.status === 'running').length, [session.turns]);
  return n ? <div className="status-line"><Loader2 size={12} className="spin" /> agent running</div> : null;
}
