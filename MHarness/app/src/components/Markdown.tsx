import { useCallback } from 'react';
import { Copy, Play, X } from 'lucide-react';
import { toast } from '../state/store';
import type { ReactNode } from 'react';
import { Fragment } from 'react';

// Minimal, fast markdown: headings, bold, inline code, lists, tables, code fences, paragraphs.
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={`${key}-b${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={`${key}-c${i++}`} className="md-code">{tok.slice(1, -1)}</code>);
    else { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok); out.push(<a key={`${key}-a${i++}`} href={mm?.[2]} target="_blank" rel="noreferrer">{mm?.[1]}</a>); }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, streaming, onRun }: { text: string; streaming?: boolean; onRun?: (lang: string, code: string) => void }) {
  const copy = useCallback(async (code: string) => { try { await navigator.clipboard.writeText(code); toast('Copied to clipboard', 'success'); } catch { toast('Clipboard unavailable', 'warning'); } }, []);
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0; let k = 0; let para: string[] = [];
  const flushPara = () => { if (para.length) { nodes.push(<p key={`p${k++}`}>{inline(para.join(' '), `p${k}`)}</p>); para = []; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flushPara();
      const lang = line.slice(3).trim(); const code: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      const open = i >= lines.length;
      i++;
      const body = code.join('\n');
      const runnable = /^(html|htm|svg)$/i.test(lang);
      nodes.push(
        <div key={`c${k++}`} className={'md-block' + (streaming && open ? ' streaming' : '')}>
          {lang && (
            <div className="md-block-lang">
              <span>{lang}{runnable ? ' · runnable' : ''}</span>
              <span className="md-block-actions">
                <button className="chip-btn" onClick={() => copy(body)}><Copy size={11} />Copy</button>
                {runnable && onRun && <button className="chip-btn" onClick={() => onRun(lang, body)} title="Run in the Preview pane"><Play size={11} />Run</button>}
              </span>
            </div>
          )}
          <pre><code>{body}{streaming && open ? '▍' : ''}</code></pre>
        </div>,
      );
      continue;
    }
    if (line.startsWith('|')) {
      flushPara();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^-+$/.test(c)));
      nodes.push(
        <table key={`t${k++}`} className="md-table">
          <thead><tr>{body[0]?.map((c, j) => <th key={j}>{inline(c, `h${j}`)}</th>)}</tr></thead>
          <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `c${ri}${j}`)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { flushPara(); const lvl = h[1].length; nodes.push(<div key={`h${k++}`} className={`md-h md-h${lvl}`}>{inline(h[2], `h${k}`)}</div>); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(); const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      nodes.push(<ul key={`u${k++}`}>{items.map((it, j) => <li key={j}>{inline(it, `l${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara(); const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      nodes.push(<ol key={`o${k++}`}>{items.map((it, j) => <li key={j}>{inline(it, `n${j}`)}</li>)}</ol>);
      continue;
    }
    if (line.trim() === '') { flushPara(); i++; continue; }
    para.push(line); i++;
  }
  flushPara();
  return <div className={'md' + (streaming ? ' md-streaming' : '')}>{nodes.map((n, idx) => <Fragment key={idx}>{n}</Fragment>)}</div>;
}

export function AdhocBanner({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="adhoc-banner"><Play size={11} /> Ad-hoc preview · {title} <span className="spacer" /><button className="icon-btn sm" onClick={onClose} title="Close ad-hoc preview"><X size={12} /></button></div>;
}
