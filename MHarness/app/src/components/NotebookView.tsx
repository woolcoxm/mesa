import { useEffect, useState } from 'react';
import { Download, Code2, FileText, Play, Loader2 } from 'lucide-react';
import type { Artifact } from '../state/types';
import { Markdown } from './Markdown';
import { toast } from '../state/store';

interface Props { artifact: Artifact; onRun?: (cells: number[]) => void; runnable?: boolean }

/** Notebook renderer: cells with execution counts and outputs; optional live execution via the server-configured interpreter; "Convert to script" downloads the code cells. */
export function NotebookView({ artifact, onRun, runnable }: Props) {
  const [showSources, setShowSources] = useState(true);
  const nb = artifact.notebook;
  if (!nb) return null;
  const lang = nb.language ?? 'python';
  const comment = lang === 'python' ? '# %%' : lang === 'typescript' || lang === 'javascript' ? '// %%' : '// %%';
  const codeCells = nb.cells.map((c, i) => (c.kind === 'code' ? i : -1)).filter((i) => i >= 0);
  const anyRunning = nb.cells.some((c) => c.outputs?.length === 1 && c.outputs[0].value === '');
  const convert = () => {
    const text = nb.cells.map((c) => (c.kind === 'markdown' ? `${comment}\n# ${c.source.replace(/\n/g, '\n# ')}` : `${comment}\n${c.source}`)).join('\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = artifact.title.replace(/\.\w+$/, '') + (lang === 'python' ? '.py' : lang === 'typescript' ? '.ts' : '.js');
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Script downloaded', 'success');
  };
  const run = (cells: number[]) => { if (!onRun) return toast(lang === 'python' ? 'Notebook execution is not configured — add "notebook": { "command": "python" } to mesa.config.json' : `Cannot run ${lang} cells`, 'warning'); onRun(cells); };
  return (
    <div className="notebook">
      <div className="nb-toolbar">
        <span className="tag">{nb.kernel ?? 'kernel'}</span>
        <span className="tag">{lang}</span>
        <span className="muted" style={{ fontSize: 11 }}>{nb.cells.length} cells · {codeCells.length} code</span>
        <span className="spacer" />
        {(runnable || !onRun) && <button className={'chip-btn' + (anyRunning ? '' : '')} disabled={anyRunning} onClick={() => run(codeCells)} title={onRun ? `Run all ${codeCells.length} code cells with ${lang}` : 'Execution not configured'}>{anyRunning ? <Loader2 size={11} className="spin" /> : <Play size={11} />}Run all</button>}
        <button className={'chip-btn' + (showSources ? ' on' : '')} onClick={() => setShowSources(!showSources)}><Code2 size={11} />Sources</button>
        <button className="chip-btn" onClick={convert} title="Download the code cells as a script"><Download size={11} />Convert to script</button>
      </div>
      <div className="nb-cells">
        {nb.cells.map((cell, i) => {
          const running = cell.kind === 'code' && cell.outputs?.length === 1 && cell.outputs[0].value === '';
          return (
            <div key={i} className={'nb-cell ' + cell.kind + (running ? ' running' : '')}>
              <div className="nb-gutter">{cell.kind === 'code' ? <span className="nb-count">In [{running ? '*' : cell.execution_count ?? ' '}]\n</span> : <FileText size={11} />}</div>
              <div className="nb-main">
                {cell.kind === 'markdown' ? <div className="nb-md"><Markdown text={cell.source} /></div> : (
                  <>
                    {showSources ? <pre className="nb-source"><code>{cell.source}</code></pre> : null}
                    {(runnable || !onRun) && <div className="nb-cell-tools"><button className="chip-btn" disabled={anyRunning} onClick={() => run([i])} title={onRun ? 'Run this cell' : 'Execution not configured'}>{running ? <Loader2 size={11} className="spin" /> : <Play size={11} />}Run</button></div>}
                  </>
                )}
                {cell.outputs?.map((o, k) => (
                  <div key={k} className={'nb-output ' + o.type}>
                    {o.type === 'image' ? <img src={o.value} alt="output" /> : o.type === 'html' ? <iframe className="nb-html" title="output" sandbox="allow-scripts" srcDoc={o.value} /> : <pre>{o.value}</pre>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function notebookThumb(nb: NonNullable<Artifact['notebook']>): string {
  return nb.cells.find((c) => c.kind === 'code')?.source.split('\n').slice(0, 8).join('\n') ?? nb.cells[0]?.source ?? '';
}
