import { X, PanelRight, GitCompare } from 'lucide-react';
import { closeCanvas, setCanvasSplit, setDockTab, pinArtifact } from '../state/store';
import type { Artifact, Session } from '../state/types';
import { ChartView, EmptyTab, HtmlThumb, kindMeta } from './Dock';
import { Markdown } from './Markdown';
import { NotebookView } from './NotebookView';

/** Resizable pane beside the thread showing one artifact live (the design brief's "canvas beside chat"). */
export function CanvasPane({ session, artifact, width }: { session: Session; artifact: Artifact; width: number }) {
  const meta = kindMeta(artifact.kind);
  const lang = artifact.kind === 'markdown' ? 'md' : artifact.kind === 'table' ? 'json' : 'ts';
  const docText = '```' + lang + '\n' + (artifact.code ?? '') + '\n```';
  return (
    <aside className="canvas-pane" style={{ width: `${width}%` }} aria-label={`Canvas: ${artifact.title}`}>
      <div className="canvas-resize" onPointerDown={(e) => {
        e.preventDefault();
        const el = e.currentTarget; el.setPointerCapture(e.pointerId);
        const pane = el.parentElement!.getBoundingClientRect();
        document.body.classList.add('resizing');
        const move = (ev: PointerEvent) => setCanvasSplit(Math.min(80, Math.max(24, ((pane.right - ev.clientX) / pane.width) * width)));
        const up = (ev: PointerEvent) => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('lostpointercapture', up); if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId); document.body.classList.remove('resizing'); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('lostpointercapture', up);
      }} />
      <div className="canvas-head">
        <span className={'kind-badge inline ' + meta.cls}>{meta.label}</span>
        <span className="canvas-title">{artifact.title}</span>
        <span className="spacer" />
        {artifact.added !== undefined && <button className="chip-btn" title="Open the diff in the dock" onClick={() => setDockTab('files')}><GitCompare size={11} />Diff</button>}
        <button className="chip-btn" title="Open in the dock's Preview tab" onClick={() => { setDockTab('preview'); closeCanvas(); }}><PanelRight size={11} />Dock</button>
        <button className={'icon-btn sm' + (artifact.pinned ? ' on' : '')} title="Pin to Gallery" onClick={() => pinArtifact(session.id, artifact.id)}><span style={{ fontSize: 11 }}>{artifact.pinned ? '★' : '☆'}</span></button>
        <button className="icon-btn sm" title="Close canvas (Esc)" onClick={closeCanvas}><X size={13} /></button>
      </div>
      <div className="canvas-body">
        {artifact.html ? <iframe title={artifact.title} sandbox="allow-scripts" srcDoc={artifact.html} />
          : artifact.kind === 'chart' && artifact.chart ? <ChartView a={artifact} />
          : artifact.notebook ? <div className="nb-wrap"><NotebookView artifact={artifact} /></div>
          : artifact.code ? <div className="doc-view"><Markdown text={docText} /></div>
          : <EmptyTab icon={<span style={{ fontSize: 18 }}>✦</span>} text="Nothing to render" sub="This artifact has no preview." />}
      </div>
    </aside>
  );
}

export function ThumbOf({ artifact }: { artifact: Artifact }) { return artifact.html ? <HtmlThumb html={artifact.html} scale={0.3} /> : null; }
