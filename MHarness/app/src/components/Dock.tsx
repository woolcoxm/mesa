import { useMemo, useRef, useState } from 'react';
import {
  Layers, Play, Share2, Pin, PinOff, FileCode2, ChartColumn, AppWindow, FileText, Table2, TestTube2, GitCompare, Sparkles, Bot, Check, Loader2, AlertTriangle, Clock, Target, History, Globe, ArrowRight, SplitSquareHorizontal, Rows3, RotateCcw, ExternalLink, Camera, MousePointerClick, FileDiff, ListChecks,
} from 'lucide-react';
import { CHART_HTML } from '../agent/scenarios';
import { focusCall, openBesideChat, openPublish, pinArtifact, setDockTab, toggleGallery, toast, insertIntoComposer } from '../state/store';
import type { Artifact, ArtifactKind, DiffInfo, Session, TLEvent, ToolCall } from '../state/types';
import { AdhocBanner, Markdown } from './Markdown';
import { clearAdhocPreview } from '../state/store';
import { useStore } from '../state/useStore';
import { DiffChip } from './Thread';

const KIND_META: Record<string, { label: string; icon: typeof FileCode2; cls: string }> = {
  code: { label: 'code', icon: FileCode2, cls: 'k-code' }, diff: { label: 'diff', icon: FileDiff, cls: 'k-diff' }, notebook: { label: 'notebook', icon: FileText, cls: 'k-doc' }, html: { label: 'html', icon: AppWindow, cls: 'k-app' }, app: { label: 'app', icon: AppWindow, cls: 'k-app' }, image: { label: 'image', icon: FileText, cls: 'k-img' }, chart: { label: 'chart', icon: ChartColumn, cls: 'k-chart' }, table: { label: 'table', icon: Table2, cls: 'k-data' }, markdown: { label: 'markdown', icon: FileText, cls: 'k-doc' }, pdf: { label: 'pdf', icon: FileText, cls: 'k-doc' }, pptx: { label: 'slides', icon: FileText, cls: 'k-doc' }, xlsx: { label: 'sheet', icon: Table2, cls: 'k-data' }, 'test-report': { label: 'tests', icon: TestTube2, cls: 'k-test' }, 'cli-output': { label: 'output', icon: FileText, cls: 'k-out' }, canvas: { label: 'canvas', icon: ChartColumn, cls: 'k-chart' },
};
export const kindMeta = (k: ArtifactKind) => KIND_META[k] ?? KIND_META.code;

function fmtBytes(n?: number) { if (!n) return ''; return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`; }
const FENCE = '```';

export function ArtifactCard({ a, session, hero }: { a: Artifact; session: Session; hero?: boolean }) {
  const meta = kindMeta(a.kind);
  const Icon = meta.icon;
  const v = a.verification;
  const [peek, setPeek] = useState<'top' | 'bottom' | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const open = () => {
    if (a.kind === 'app' || a.kind === 'html' || a.kind === 'chart') setDockTab('preview');
    else if (a.kind === 'code' && (a.added ?? 0) + (a.removed ?? 0) > 0 && a.added !== a.lines) setDockTab('files');
    else if (a.kind === 'test-report') setDockTab('run');
    else setDockTab('preview');
  };
  return (
    <div ref={cardRef} className={'acard' + (hero ? ' hero' : '')} onClick={open} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      onMouseEnter={() => { peekTimer.current = setTimeout(() => { const r = cardRef.current?.getBoundingClientRect(); setPeek(r && r.top < 330 ? 'bottom' : 'top'); }, 450); }} onMouseLeave={() => { if (peekTimer.current) clearTimeout(peekTimer.current); setPeek(null); }}>
      {peek && (
        <div className={'peek card-peek ' + peek} role="tooltip">
          <div className="peek-head">{a.title}<span className="muted"> · {a.path}</span></div>
          <div className="card-peek-body">{a.html ? <div className="thumb-live"><HtmlThumb html={a.html} scale={0.3} /></div> : a.kind === 'chart' ? <Thumb a={a} /> : a.code ? <pre className="thumb-code">{a.code.split('\n').slice(0, 14).join('\n')}</pre> : <div className="thumb-blank"><Icon size={20} /></div>}</div>
        </div>
      )}
      <div className="acard-thumb">
        <Thumb a={a} hero={hero} />
        <span className={'kind-badge ' + meta.cls}><Icon size={11} />{meta.label}</span>
        {a.framework && <span className="tag framework">{a.framework}</span>}
      </div>
      <div className="acard-body">
        <div className="acard-title">{a.title}</div>
        <div className="acard-path">{a.path}</div>
        <div className="acard-stats">
          {a.added !== undefined && <span className="add">+{a.added}</span>}{a.removed ? <span className="del">−{a.removed}</span> : null}
          {a.lines ? <span>{a.lines} lines</span> : null}{a.bytes ? <span>{fmtBytes(a.bytes)}</span> : null}
          {v?.tests === 'pass' && <span className="v ok">✓ tests</span>}{v?.tests === 'fail' && <span className="v bad">✗ tests</span>}
          {v?.preview === 'ready' && <span className="v ok">preview ready</span>}
        </div>
      </div>
      <div className="acard-actions" onClick={(e) => e.stopPropagation()} onMouseEnter={() => { if (peekTimer.current) clearTimeout(peekTimer.current); setPeek(null); }}>
        <button className="chip-btn" onClick={open}>Open</button>
        {(a.kind === 'app' || a.kind === 'chart' || a.kind === 'code') && <button className="chip-btn" onClick={() => { setDockTab('preview'); toast(`Running ${a.title}`, 'info'); }}><Play size={11} />Run</button>}
        {(a.html || a.kind === 'chart') && <button className="chip-btn" title="Show live beside the conversation" onClick={() => openBesideChat(session.id, a.id)}>⫶ Beside</button>}
        {a.added !== undefined && <button className="chip-btn" onClick={() => setDockTab('files')}><GitCompare size={11} />Compare</button>}
        <button className="chip-btn" title="Share / publish" onClick={() => a.html ? openPublish(session.id, a.id) : toast('Publishing is for HTML artifacts — use Pin to keep this one in the Gallery', 'info')}><Share2 size={11} /></button>
        <button className={'chip-btn' + (a.pinned ? ' on' : '')} onClick={() => pinArtifact(session.id, a.id)} title="Pin to Gallery">{a.pinned ? <PinOff size={11} /> : <Pin size={11} />}</button>
      </div>
    </div>
  );
}

export function HtmlThumb({ html, scale = 0.5 }: { html: string; scale?: number }) {
  const doc = html.replace(/<body([^>]*)>/i, (_m, attrs: string) => `<body${attrs} style="${attrs.match(/style="([^"]*)"/)?.[1] ?? ''};transform:scale(${scale});transform-origin:top left;overflow:hidden">`);
  return <iframe title="" sandbox="allow-scripts" scrolling="no" tabIndex={-1} style={{ width: `${100 / scale}%`, height: `${100 / scale}%` }} srcDoc={doc} />;
}

function Thumb({ a, hero }: { a: Artifact; hero?: boolean }) {
  if ((a.kind === 'app' || a.kind === 'html') && a.html) return <div className="thumb-live"><HtmlThumb html={a.html} scale={hero ? 0.42 : 0.34} /></div>;
  if (a.kind === 'app' || a.kind === 'html') return <div className="thumb-app"><div className="thumb-app-card"><span className="ta-pill" /><span className="ta-h" /><div className="ta-bars">{[42, 60, 48, 78, 64, 90].map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />)}</div><span className="ta-row" /><span className="ta-row short" /></div></div>;
  if (a.kind === 'chart' && a.chart) {
    const max = Math.max(...a.chart.values);
    return <div className="thumb-chart"><div className="tc-title">{a.chart.title}</div><div className="tc-bars">{a.chart.values.map((v, i) => <div key={i} className="tc-b" style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 50}ms` }} />)}</div></div>;
  }
  if (a.code) return <pre className="thumb-code">{a.code.split('\n').slice(0, hero ? 10 : 6).join('\n')}</pre>;
  return <div className="thumb-blank"><FileText size={20} /></div>;
}

export function ArtifactsTab({ session }: { session: Session }) {
  const [filter, setFilter] = useState<'all' | 'delivered' | 'changed' | 'pinned'>('all');
  const delivered = new Set(session.turns.flatMap((t) => t.deliverables));
  const items = useMemo(() => session.artifacts.filter((a) => filter === 'all' ? true : filter === 'delivered' ? delivered.has(a.id) : filter === 'changed' ? !delivered.has(a.id) : a.pinned).reverse(), [session.artifacts, filter, session.turns]);
  const changed = session.artifacts.filter((a) => !delivered.has(a.id));
  return (
    <div className="tab-scroll">
      <div className="tab-head"><Layers size={14} /><b>Artifacts</b><span className="muted">{session.artifacts.length}</span><span className="spacer" /><button className="chip-btn" onClick={() => toggleGallery(true)}>Gallery</button></div>
      <div className="filters">{(['all', 'delivered', 'changed', 'pinned'] as const).map((f) => <button key={f} className={'filter' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{f}{f === 'pinned' ? ` ${session.artifacts.filter((a) => a.pinned).length}` : ''}</button>)}</div>
      {items.length === 0 ? <EmptyTab icon={<Layers size={22} />} text="No artifacts yet" sub="Deliverables the agent declares with present land here." /> : <div className="agrid">{items.map((a) => <ArtifactCard key={a.id} a={a} session={session} hero={filter === 'all' && delivered.has(a.id)} />)}</div>}
      {changed.length > 0 && filter !== 'changed' && (
        <div className="changed-block">
          <div className="section-title">Changed files <span className="muted">{changed.length}</span></div>
          {changed.map((a) => { const diff = findDiff(session, a.path); return <button key={a.id} className="changed-row" onClick={() => setDockTab('files')}><FileCode2 size={13} /><span className="cr-path">{a.path}</span><span className="cr-stat"><span className="add">+{a.added ?? 0}</span> <span className="del">−{a.removed ?? 0}</span></span>{diff && <DiffChip diff={diff} />}<ArrowRight size={12} /></button>; })}
        </div>
      )}
    </div>
  );
}

export function findDiff(session: Session, path: string): DiffInfo | undefined {
  for (const t of [...session.turns].reverse()) for (const b of [...t.blocks].reverse()) if (b.type === 'tool' && b.call.diff && path.endsWith(b.call.diff.file)) return b.call.diff;
  return undefined;
}

type DiffCall = ToolCall & { diff: DiffInfo };

export function FilesTab({ session }: { session: Session }) {
  const diffs = useMemo(() => session.turns.flatMap((t) => t.blocks.filter((b) => b.type === 'tool' && !!b.call.diff).map((b) => (b.type === 'tool' ? b.call : null)).filter((c): c is DiffCall => !!c && !!c.diff)).reverse(), [session.turns]);
  const [sel, setSel] = useState<string | undefined>(undefined);
  const [split, setSplit] = useState(false);
  const current = diffs.find((d) => d.id === sel) ?? diffs[0];
  return (
    <div className="tab-scroll files-tab">
      <div className="tab-head"><FileDiff size={14} /><b>Files & diffs</b><span className="muted">{diffs.length}</span><span className="spacer" /><button className={'icon-btn sm' + (split ? ' on' : '')} title="Split view" onClick={() => setSplit(!split)}>{split ? <Rows3 size={13} /> : <SplitSquareHorizontal size={13} />}</button></div>
      {diffs.length === 0 ? <EmptyTab icon={<FileDiff size={22} />} text="No diffs yet" sub="Edits made by the agent show up here with a one-click diff." /> : (
        <div className="files-split">
          <div className="file-list">{diffs.map((d) => <button key={d.id} className={'file-row' + (current?.id === d.id ? ' on' : '')} onClick={() => setSel(d.id)}><span className={'fr-state ' + (d.status === 'success' ? 'ok' : d.status === 'denied' ? 'bad' : 'run')} /><span className="fr-name">{d.diff.file}</span><span className="fr-stat"><span className="add">+{d.diff.added}</span> <span className="del">−{d.diff.removed}</span></span></button>)}</div>
          <div className="file-diff">{current && <DiffViewer key={current.id + String(split)} call={current} split={split} />}</div>
        </div>
      )}
    </div>
  );
}

function DiffViewer({ call, split }: { call: DiffCall; split: boolean }) {
  const d = call.diff;
  return (
    <div className="dv">
      <div className="dv-head"><span className="dv-file">{d.file}</span><span className="add">+{d.added}</span><span className="del">−{d.removed}</span><span className="spacer" /><span className="muted">{call.status === 'success' ? 'applied' : call.status}</span></div>
      {d.hunks.map((h, hi) => (
        <div key={hi} className="hunk">
          <div className="hunk-head"><span className="hunk-r">@@ -{h.oldStart},{h.oldLines.length} +{h.newStart},{h.newLines.length} @@</span><button className="chip-btn" onClick={() => insertIntoComposer(`@hunk:${d.file}#L${h.newStart}-L${h.newStart + h.newLines.length} Explain this change`)}><Sparkles size={11} />Explain this hunk</button></div>
          {split ? (
            <div className="dv-cols"><pre className="dv-col del">{h.oldLines.map((l, i) => <div key={i} className="dl -">− {l}</div>)}</pre><pre className="dv-col add">{h.newLines.map((l, i) => <div key={i} className="dl +">+ {l}</div>)}</pre></div>
          ) : (
            <pre className="dv-uni">{h.oldLines.map((l, i) => <div key={'o' + i} className="dl -" style={{ animationDelay: `${i * 80}ms` }}>− {l}</div>)}{h.newLines.map((l, i) => <div key={'n' + i} className="dl +" style={{ animationDelay: `${(h.oldLines.length + i) * 80}ms` }}>+ {l}</div>)}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

export function AgentsTab({ session }: { session: Session }) {
  const [view, setView] = useState<'tree' | 'board'>('tree');
  const plan = session.plan;
  return (
    <div className="tab-scroll">
      <div className="tab-head"><Bot size={14} /><b>Agents</b><span className="muted">{session.agents.length + 1}</span><span className="spacer" /><div className="seg"><button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}>Tree</button><button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button></div></div>
      {view === 'tree' ? (
        <div className="agent-tree">
          <div className="agent-node root"><span className="an-mark pulse">M</span><div><b>lead</b> · {session.model}<div className="an-sub">{session.turns.length} turns · ${session.cost.toFixed(3)}</div></div><span className={'an-state ' + (session.state === 'running' ? 'running' : 'idle')}>{session.state}</span></div>
          {session.agents.map((a) => (
            <div key={a.id} className="agent-node child"><span className="an-line" /><span className="an-mark small">A</span><div><b>{a.name}</b><div className="an-sub">{a.role}{a.note ? ` · ${a.note}` : ''}</div></div><span className="an-cost">${a.cost.toFixed(3)}</span><span className={'an-state ' + a.status}>{a.status === 'running' ? <Loader2 size={11} className="spin" /> : a.status === 'done' ? <Check size={11} /> : null}{a.status}</span></div>
          ))}
          {!session.agents.length && <EmptyTab icon={<Bot size={22} />} text="No subagents yet" sub="Ask for a multi-file refactor to see the tree fill in." />}
        </div>
      ) : (
        <div className="board">
          {(['todo', 'doing', 'done'] as const).map((col) => <div key={col} className="board-col"><div className="board-head">{col}<span>{plan?.items.filter((i) => i.state === col).length ?? 0}</span></div>{(plan?.items ?? []).filter((i) => i.state === col).map((i) => <div key={i.text} className={'board-card ' + col}>{col === 'doing' ? <Loader2 size={12} className="spin" /> : col === 'done' ? <Check size={12} /> : <Clock size={12} />}<span>{i.text}</span></div>)}{!plan?.items.some((i) => i.state === col) && <div className="board-empty">—</div>}</div>)}
        </div>
      )}
    </div>
  );
}

export function StatsTab({ session }: { session: Session }) {
  const rows = session.turns.filter((t) => t.usage.inputTokens > 0);
  const tot = rows.reduce((a, t) => ({ i: a.i + t.usage.inputTokens, o: a.o + t.usage.outputTokens, c: a.c + t.usage.cachedTokens, $: a.$ + t.usage.costUsd, ms: a.ms + t.usage.latencyMs }), { i: 0, o: 0, c: 0, $: 0, ms: 0 });
  return (
    <div className="tab-scroll">
      <div className="tab-head"><b>Stats</b><span className="muted">per turn</span></div>
      <div className="stat-cards">
        <div className="stat"><span>Context</span><b>{session.tokens.toLocaleString()}</b><i>/ {session.contextMax.toLocaleString()}</i></div>
        <div className="stat"><span>Cache hit</span><b>{Math.round(session.cacheHit * 100)} %</b></div>
        <div className="stat"><span>Cost</span><b>${tot.$.toFixed(4)}</b></div>
        <div className="stat"><span>Avg latency</span><b>{rows.length ? (tot.ms / rows.length / 1000).toFixed(1) : '0'}s</b></div>
      </div>
      <table className="stats-table"><thead><tr><th>Turn</th><th>Tools</th><th>In</th><th>Out</th><th>Cached</th><th>Time</th><th>Cost</th></tr></thead>
        <tbody>{rows.map((t, i) => <tr key={t.id}><td className="ellip" title={t.user}>{i + 1}. {t.user}</td><td>{t.blocks.filter((b) => b.type === 'tool').length}</td><td>{t.usage.inputTokens.toLocaleString()}</td><td>{t.usage.outputTokens.toLocaleString()}</td><td>{t.usage.cachedTokens.toLocaleString()}</td><td>{(t.usage.latencyMs / 1000).toFixed(1)}s</td><td>${t.usage.costUsd.toFixed(4)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total</td><td></td><td>{tot.i.toLocaleString()}</td><td>{tot.o.toLocaleString()}</td><td>{tot.c.toLocaleString()}</td><td>{(tot.ms / 1000).toFixed(1)}s</td><td>${tot.$.toFixed(4)}</td></tr></tfoot></table>
      {!rows.length && <EmptyTab icon={<Target size={22} />} text="No turns yet" sub="Tokens, cache and cost appear after the first turn." />}
    </div>
  );
}

const TL_ICON: Record<TLEvent['kind'], typeof History> = { turn: ArrowRight, tool: Sparkles, run: Play, approval: AlertTriangle, artifact: FileCode2, checkpoint: RotateCcw, present: Layers };
export function TimelineTab({ session }: { session: Session }) {
  const maxMs = Math.max(1, ...session.timeline.map((e) => e.ms ?? 0));
  return (
    <div className="tab-scroll">
      <div className="tab-head"><History size={14} /><b>Timeline</b><span className="muted">{session.timeline.length} events</span></div>
      {session.checkpoints.length > 0 && <div className="checkpoints">{session.checkpoints.map((c) => <button key={c.id} className="cp" onClick={() => toast(`Checkpoint "${c.label}" — restore is a demo action`, 'info')}><RotateCcw size={12} />{c.label}{c.auto && <span className="tag">auto</span>}</button>)}</div>}
      <div className="tl">{session.timeline.map((e, i) => { const Icon = TL_ICON[e.kind]; return <div key={e.id} className={'tl-row k-' + e.kind + (e.callId ? ' clickable' : '')} style={{ animationDelay: `${Math.min(300, i * 20)}ms` }} onClick={() => e.callId && focusCall(e.callId)} title={e.callId ? 'Jump to this call in the thread' : undefined}><span className="tl-time">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span><span className="tl-icon"><Icon size={11} /></span><span className="tl-label">{e.label}</span>{e.ms ? <span className="tl-bar"><i style={{ width: `${Math.max(4, (e.ms / maxMs) * 100)}%` }} /></span> : null}{e.ms ? <span className="tl-ms">{(e.ms / 1000).toFixed(1)}s</span> : null}</div>; })}</div>
      {!session.timeline.length && <EmptyTab icon={<History size={22} />} text="No events yet" sub="Every tool call, run, approval and artifact is recorded here." />}
    </div>
  );
}

export function BrowserTab({ session }: { session: Session }) {
  const [url, setUrl] = useState('http://localhost:5173');
  const app = session.artifacts.find((a) => a.kind === 'app');
  return (
    <div className="browser-tab">
      <div className="browser-bar"><button className="icon-btn sm" title="Back" onClick={() => toast('History is empty in the demo browser', 'info')}>‹</button><button className="icon-btn sm" title="Forward" onClick={() => toast('History is empty in the demo browser', 'info')}>›</button><button className="icon-btn sm" title="Reload" onClick={() => { const f = document.querySelector('.browser-body iframe') as HTMLIFrameElement | null; if (f) { const s = f.srcdoc; f.srcdoc = ''; setTimeout(() => { f.srcdoc = s; }, 30); } toast('Reloading preview', 'info'); }}>⟳</button><div className="url"><Globe size={12} /><input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') toast(`Navigating to ${url} (demo browser keeps the generated app)`, 'info'); }} aria-label="URL" /></div><button className="icon-btn sm" onClick={() => toast('Opening in system browser (demo)', 'info')}><ExternalLink size={12} /></button></div>
      <div className="browser-body">{app ? <iframe title="browser" sandbox="allow-scripts" srcDoc={app.html} /> : <EmptyTab icon={<Globe size={22} />} text="Nothing to browse" sub="Build an app and it appears here." />}</div>
      <div className="browser-panel"><div className="bp-tabs"><span className="on">Console</span><span>Network</span></div><div className="bp-body"><div className="bp-log"><span className="lv">log</span>[vite] connecting…</div><div className="bp-log"><span className="lv">log</span>[vite] connected.</div><div className="bp-log"><span className="lv">hmr</span>update /src/App.tsx</div></div></div>
    </div>
  );
}

export function EmptyTab({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return <div className="empty-tab"><div className="et-icon">{icon}</div><div className="et-text">{text}</div>{sub && <div className="et-sub">{sub}</div>}</div>;
}

export function ChartView({ a }: { a: Artifact }) {
  if (!a.chart) return null;
  return <iframe className="chart-frame" title={a.title} sandbox="allow-scripts" srcDoc={CHART_HTML(a.chart)} />;
}

export function PreviewTab({ session }: { session: Session }) {
  const app = [...session.artifacts].reverse().find((a) => a.kind === 'app' || a.kind === 'html');
  const chart = [...session.artifacts].reverse().find((a) => a.kind === 'chart');
  const doc = [...session.artifacts].reverse().find((a) => a.kind === 'markdown' || a.kind === 'table' || a.kind === 'code');
  const [device, setDevice] = useState(0);
  const [panel, setPanel] = useState<'console' | 'network' | 'none'>('none');
  const [mode, setMode] = useState<'app' | 'chart' | 'doc'>(app ? 'app' : chart ? 'chart' : 'doc');
  const adhoc = useStore().adhoc;
  const sizes = [{ w: 0, h: 0, l: 'Fit' }, { w: 390, h: 844, l: 'Phone' }, { w: 768, h: 1024, l: 'Tablet' }, { w: 1440, h: 900, l: 'Desktop' }];
  const s = sizes[device];
  const show = adhoc ? ({ kind: 'app', title: adhoc.title, html: adhoc.html, path: 'from chat' } as unknown as Artifact) : mode === 'app' ? app || chart : mode === 'chart' ? chart : doc;
  const lang = show?.kind === 'markdown' ? 'md' : show?.kind === 'table' ? 'json' : 'ts';
  const docText = show && show.code ? FENCE + lang + '\n' + show.code + '\n' + FENCE : '';
  const run = session.runs.find((r) => r.port);
  return (
    <div className="preview-tab">
      {adhoc && <AdhocBanner title={adhoc.title} onClose={clearAdhocPreview} />}
      <div className="preview-bar">
        <div className="seg">{(['app', 'chart', 'doc'] as const).filter((m) => m === 'app' ? !!(app || chart) : m === 'chart' ? !!chart : !!doc).map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'app' ? 'App' : m === 'chart' ? 'Chart' : 'Doc'}</button>)}</div>
        <div className="url">{run?.port ? `http://localhost:${run.port}` : show?.path ?? '—'}</div>
        <span className="spacer" />
        <div className="seg devices">{sizes.map((d, i) => <button key={d.l} className={device === i ? 'on' : ''} onClick={() => setDevice(i)} title={`${d.w}×${d.h}`}>{d.l}</button>)}</div>
        <div className="seg"><button className={panel === 'console' ? 'on' : ''} onClick={() => setPanel(panel === 'console' ? 'none' : 'console')}>Console</button><button className={panel === 'network' ? 'on' : ''} onClick={() => setPanel(panel === 'network' ? 'none' : 'network')}>Network</button></div>
        <button className="icon-btn sm" title="Screenshot to chat" onClick={() => { insertIntoComposer('@screenshot preview.png (390×844) — '); toast('Screenshot attached to composer', 'success'); }}><Camera size={13} /></button>
        <button className="icon-btn sm" title="Send element to agent" onClick={() => { insertIntoComposer('@element '); toast('Inspector on — click an element in the preview', 'info'); }}><MousePointerClick size={13} /></button>
        <button className="icon-btn sm" title="Open in browser" onClick={() => toast('Opening in system browser (demo)', 'info')}><ExternalLink size={13} /></button>
      </div>
      <div className="preview-stage">
        <div className="device" style={device === 0 ? { width: '100%', height: '100%' } : { width: s.w, height: s.h }}>
          {show ? (
            show.kind === 'chart' ? <ChartView a={show} /> : show.kind === 'app' || show.kind === 'html' ? <iframe title="preview" sandbox="allow-scripts" srcDoc={show.html ?? ''} /> : show.code ? <div className="doc-view"><Markdown text={docText} /></div> : <EmptyTab icon={<AppWindow size={22} />} text="Nothing to preview" sub="Build an app or ask for a chart." />
          ) : <EmptyTab icon={<AppWindow size={22} />} text="Nothing to preview" sub="Build an app or ask for a chart." />}
        </div>
      </div>
      {panel !== 'none' && (
        <div className="preview-panel">
          {panel === 'console' ? <><div className="bp-log"><span className="lv">log</span>[vite] connecting…</div><div className="bp-log"><span className="lv">log</span>[vite] connected.</div><div className="bp-log"><span className="lv">hmr</span>update /src/App.tsx</div><div className="bp-log"><span className="lv warn">warn</span>[react] dev mode enabled</div></> : <><div className="bp-net"><span>GET</span><span>/</span><span>200</span><span>text/html</span></div><div className="bp-net"><span>GET</span><span>/src/App.tsx</span><span>200</span><span>text/javascript</span></div><div className="bp-net"><span>WS</span><span>/?token=hmr</span><span>101</span><span>websocket</span></div></>}
        </div>
      )}
    </div>
  );
}
