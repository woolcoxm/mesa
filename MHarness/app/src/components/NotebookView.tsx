import { useState } from 'react';
import { Download, Code2, FileText, Play } from 'lucide-react';
import type { Artifact } from '../state/types';
import { Markdown } from './Markdown';
import { toast } from '../state/store';

/** Read-only notebook renderer: cells with execution counts and their outputs; "Convert to script" downloads the code cells. */
export function NotebookView({ artifact }: { artifact: Artifact }) {
  const [showSources, setShowSources] = useState(true);
  const nb = artifact.notebook;
  if (!nb) return null;
  const lang = nb.language ?? 'python';
  const comment = lang === 'python' ? '# %%' : lang === 'typescript' || lang === 'javascript' ? '// %%' : '// %%';
  const convert = () => {
    const text = nb.cells.map((c) => (c.kind === 'markdown' ? `${comment}\n# ${c.source.replace(/\n/g, '\n# ')}` : `${comment}\n${c.source}`)).join('\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = artifact.title.replace(/\.\w+$/, '') + (lang === 'python' ? '.py' : lang === 'typescript' ? '.ts' : '.js');
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Script downloaded', 'success');
  };
  return (
    <div className="notebook">
      <div className="nb-toolbar">
        <span className="tag">{nb.kernel ?? 'kernel'}</span>
        <span className="tag">{lang}</span>
        <span className="muted" style={{ fontSize: 11 }}>{nb.cells.length} cells · {nb.cells.filter((c) => c.kind === 'code').length} code</span>
        <span className="spacer" />
        <button className={'chip-btn' + (showSources ? ' on' : '')} onClick={() => setShowSources(!showSources)}><Code2 size={11} />Sources</button>
        <button className="chip-btn" onClick={convert} title="Download the code cells as a script"><Download size={11} />Convert to script</button>
      </div>
      <div className="nb-cells">
        {nb.cells.map((cell, i) => (
          <div key={i} className={'nb-cell ' + cell.kind}>
            <div className="nb-gutter">{cell.kind === 'code' ? <span className="nb-count">In [{cell.execution_count ?? ' '}]\n</span> : <FileText size={11} />}</div>
            <div className="nb-main">
              {cell.kind === 'markdown' ? <div className="nb-md"><Markdown text={cell.source} /></div> : showSources ? <pre className="nb-source"><code>{cell.source}</code></pre> : null}
              {cell.outputs?.map((o, k) => (
                <div key={k} className={'nb-output ' + o.type}>
                  {o.type === 'image' ? <img src={o.value} alt="output" /> : o.type === 'html' ? <iframe className="nb-html" title="output" sandbox="allow-scripts" srcDoc={o.value} /> : <pre>{o.value}</pre>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function notebookThumb(nb: NonNullable<Artifact['notebook']>): string {
  return nb.cells.find((c) => c.kind === 'code')?.source.split('\n').slice(0, 8).join('\n') ?? nb.cells[0]?.source ?? '';
}

export const PlayIcon = Play;
