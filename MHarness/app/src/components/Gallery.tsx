import { useMemo, useState } from 'react';
import { X, Search, Pin, Layers, GitCompare, RotateCcw, Share2, Sparkles, Tag, ArrowLeft } from 'lucide-react';
import { getState, setGalleryFilter, toggleGallery, toast } from '../state/store';
import { useStore } from '../state/useStore';
import { kindMeta, HtmlThumb } from './Dock';
import { openPublish } from '../state/store';
import { NotebookView, notebookThumb } from './NotebookView';
import { Markdown } from './Markdown';
import type { Artifact } from '../state/types';

const KINDS = ['all', 'app', 'chart', 'code', 'markdown', 'table', 'test-report'];

export function Gallery() {
  const st = useStore();
  const g = st.gallery;
  const items = useMemo(() => {
    const all = st.sessions.flatMap((s) => s.artifacts.map((a) => ({ a, s })));
    const q = g.query.toLowerCase();
    return all.filter(({ a, s }) => (g.kind === 'all' || a.kind === g.kind) && (!q || a.title.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))).sort((x, y) => Number(y.a.pinned) - Number(x.a.pinned) || y.a.createdAt - x.a.createdAt);
  }, [st.sessions, g.kind, g.query]);
  const sel = items.find(({ a }) => a.id === g.selected);
  const compare = items.find(({ a }) => a.id === g.compareWith && a.id !== g.selected);
  if (!g.open) return null;
  return (
    <div className="overlay gallery-overlay" role="dialog" aria-label="Gallery" onMouseDown={() => toggleGallery(false)}>
      <div className="gallery" onMouseDown={(e) => e.stopPropagation()}>
        <div className="gallery-head">
          <Layers size={16} /><b>Gallery</b><span className="muted">{items.length} artifacts · {items.filter((i) => i.a.pinned).length} pinned</span><span className="spacer" />
          <div className="rail-search inline"><Search size={13} /><input placeholder="Search deliverables across sessions" value={g.query} onChange={(e) => setGalleryFilter({ query: e.target.value })} /></div>
          <button className="icon-btn" onClick={() => toggleGallery(false)} title="Close (Esc)"><X size={16} /></button>
        </div>
        <div className="filters">{KINDS.map((k) => <button key={k} className={'filter' + (g.kind === k ? ' on' : '')} onClick={() => setGalleryFilter({ kind: k })}>{k}</button>)}</div>
        {sel ? (
          <div className="gallery-detail">
            <button className="chip-btn" onClick={() => setGalleryFilter({ selected: undefined, compareWith: undefined })}><ArrowLeft size={11} />Back</button>
            <div className="gd-head"><b>{sel.a.title}</b><span className="muted">{sel.a.path} · {sel.s.title}</span><span className="spacer" />
              <select value={g.compareWith ?? ''} onChange={(e) => setGalleryFilter({ compareWith: e.target.value || undefined })} aria-label="Compare with"><option value="">Compare with…</option>{items.filter((i) => i.a.path === sel.a.path && i.a.id !== sel.a.id).map((i) => <option key={i.a.id} value={i.a.id}>{i.s.title}</option>)}</select>
              <button className="chip-btn" onClick={() => toast(`Re-running ${sel.a.title} with fresh inputs (demo)`, 'info')}><RotateCcw size={11} />Re-run with fresh inputs</button>
              <button className="chip-btn" onClick={() => sel.a.html ? openPublish(sel.s.id, sel.a.id) : toast('Publishing is for HTML artifacts', 'info')}><Share2 size={11} />Publish</button></div>
            <div className={'gd-body' + (compare ? ' split' : '')}>
              <div className="gd-pane">{sel.a.kind === 'chart' && sel.a.chart ? <ChartPane a={sel.a} /> : sel.a.notebook ? <div className="nb-wrap"><NotebookView artifact={sel.a} /></div> : sel.a.kind === 'app' ? <iframe title="preview" sandbox="allow-scripts" srcDoc={sel.a.html ?? ''} /> : sel.a.code ? <Markdown text={'```' + (sel.a.kind === 'markdown' ? 'md' : sel.a.kind === 'table' ? 'json' : 'ts') + '\n' + sel.a.code + '\n```'} /> : <div className="thumb-blank" />}<div className="gd-caption">{compare ? 'Current' : ''}</div></div>
              {compare && <div className="gd-pane">{compare.a.html ? <iframe title="compare" sandbox="allow-scripts" srcDoc={compare.a.html} /> : <Markdown text={'```ts\n' + (compare.a.code ?? '') + '\n```'} />}<div className="gd-caption">Previous version · {compare.s.title}</div></div>}
            </div>
            <div className="gd-tags">{(sel.a.tags ?? []).map((t) => <span key={t} className="tag"><Tag size={10} />{t}</span>)}{sel.a.inputs && <span className="tag">inputs: {Object.keys(sel.a.inputs).join(', ')}</span>}</div>
          </div>
        ) : (
          <div className="gallery-grid">
            {items.map(({ a, s }) => { const meta = kindMeta(a.kind); const Icon = meta.icon; return (
              <button key={a.id} className={'gcard' + (a.pinned ? ' pinned' : '')} onClick={() => setGalleryFilter({ selected: a.id })}>
                <div className="gcard-thumb">{a.kind === 'chart' && a.chart ? <ChartPane a={a} mini /> : a.kind === 'app' || a.kind === 'html' ? (a.html ? <div className="thumb-live"><HtmlThumb html={a.html} scale={0.4} /></div> : <div className="thumb-app"><div className="thumb-app-card"><span className="ta-pill" /><span className="ta-h" /><div className="ta-bars">{[42, 60, 48, 78, 64, 90].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></div></div>) : a.notebook ? <pre className="thumb-code">{notebookThumb(a.notebook)}</pre> : a.code ? <pre className="thumb-code">{a.code.split('\n').slice(0, 7).join('\n')}</pre> : <div className="thumb-blank"><Icon size={18} /></div>}<span className={'kind-badge ' + meta.cls}><Icon size={11} />{meta.label}</span>{a.pinned && <Pin size={12} className="pin-mark" />}</div>
                <div className="gcard-title">{a.title}</div>
                <div className="gcard-sub">{s.title} · {a.lines ? `${a.lines} lines` : a.bytes ? `${(a.bytes / 1024).toFixed(1)} kB` : ''}</div>
              </button>); })}
            {!items.length && <div className="menu-empty" style={{ padding: 40 }}>Nothing in the Gallery yet. Pin deliverables from a showcase.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartPane({ a, mini }: { a: Artifact; mini?: boolean }) {
  const ch = a.chart!; const max = Math.max(...ch.values);
  return <div className={'chart-pane' + (mini ? ' mini' : '')}><div className="tc-title">{ch.title}</div><div className="tc-bars">{ch.values.map((v, i) => <div key={i} className="tc-b" style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 50}ms` }} title={`${ch.labels[i]}: ${v.toLocaleString()}`} />)}</div><div className="tc-labels">{ch.labels.map((l) => <span key={l}>{l}</span>)}</div></div>;
}
