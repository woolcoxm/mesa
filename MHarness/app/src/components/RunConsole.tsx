import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Plus, Play, Square, RotateCcw, Bell, BellRing, Save, Zap, ChevronRight, ChevronDown, Radio, Circle } from 'lucide-react';
import { getState, killRun, newTerminal, restartRun, selectRun, setDockTab, toast } from '../state/store';
import type { Run, Session } from '../state/types';
import { EmptyTab } from './Dock';

export function Terminal({ session, run }: { session: Session; run: Run }) {
  const ref = useRef<HTMLDivElement>(null);
  const term = useRef<XTerm | null>(null);
  const written = useRef(0);
  useEffect(() => {
    if (!ref.current) return;
    const dark = getState().settings.theme === 'dark';
    const t = new XTerm({
      fontFamily: "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.35, cursorBlink: true, cursorStyle: 'bar', scrollback: 10000,
      theme: { background: dark ? '#0b0d11' : '#eceef2', foreground: dark ? '#e8ebef' : '#15181d', cursor: dark ? '#7c86ff' : '#4f5bd9', selectionBackground: dark ? 'rgba(124,134,255,.35)' : 'rgba(79,91,217,.25)', black: '#15181d', red: '#ff6b6b', green: '#37c981', yellow: '#f0a62a', blue: '#4fb3ff', magenta: '#c792ea', cyan: '#4fd6be', white: '#e8ebef', brightBlack: dark ? '#6b7684' : '#8a93a1' },
    });
    const fit = new FitAddon(); t.loadAddon(fit); t.open(ref.current); fit.fit();
    t.writeln(`\x1b[1;36mMesa\x1b[0m \x1b[2m· ${run.runtime} · ${run.cwd}\x1b[0m`);
    t.writeln(`\x1b[2m${run.owner === 'user' ? 'user terminal' : 'agent-owned · read-only to agent'}\x1b[0m`);
    term.current = t; written.current = 0;
    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} }); ro.observe(ref.current);
    t.onData((d) => {
      if (run.status !== 'running' && d !== '\r') return;
      if (d === '\r') { t.write('\r\n'); import('../state/store').then((m) => m.terminalInput(session.id, run.id, '\r')); return; }
      if (d === '\u007f') { t.write('\b \b'); import('../state/store').then((m) => m.terminalInput(session.id, run.id, d)); return; }
      if (d.charCodeAt(0) >= 32) { t.write(d); import('../state/store').then((m) => m.terminalInput(session.id, run.id, d)); }
    });
    return () => { ro.disconnect(); t.dispose(); term.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);
  useEffect(() => {
    const t = term.current; if (!t) return;
    const start = Math.min(written.current, run.lines.length);
    for (let i = start; i < run.lines.length; i++) t.writeln(colorize(run.lines[i]));
    written.current = run.lines.length;
    if (run.status === 'running') t.write(`\r\n\x1b[1;35mmesa ${run.cwd}>\x1b[0m `);
    else if (run.status === 'exited') t.write(`\r\n\x1b[2mprocess exited with code ${run.exitCode ?? 0}\x1b[0m\r\n`);
    else if (run.status === 'killed') t.write(`\r\n\x1b[2mkilled\x1b[0m\r\n`);
    else if (run.status === 'failed') t.write(`\r\n\x1b[31mprocess failed (exit ${run.exitCode ?? 1})\x1b[0m\r\n`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.lines.length, run.status]);
  return <div ref={ref} className="xterm-host" onClick={() => term.current?.focus()} />;
}

function colorize(line: string): string {
  let s = line.replace(/[&<>]/g, (c) => ({ '&': '&', '<': '<', '>': '>' }[c] as string));
  if (/^\$ /.test(s)) return `\x1b[1;35m${s}\x1b[0m`;
  if (/(✓|passed|ready|Done|ok |Success)/.test(s)) s = s.replace(/✓/g, '\x1b[32m✓\x1b[0m').replace(/passed/g, '\x1b[32mpassed\x1b[0m').replace(/ready/g, '\x1b[32mready\x1b[0m');
  if (/(✗|×|failed|Error|error)/.test(s)) s = s.replace(/[✗×]/g, '\x1b[31m$&\x1b[0m').replace(/failed/g, '\x1b[31mfailed\x1b[0m');
  if (/^(➜|>)/.test(s)) s = `\x1b[2m${s}\x1b[0m`;
  if (/^(VITE|\d{2}:\d{2}:\d{2})/.test(s)) s = `\x1b[36m${s}\x1b[0m`;
  return s;
}

export function RunConsole({ session }: { session: Session }) {
  const runs = session.runs;
  const selected = runs.find((r) => r.id === session.selectedRunId) ?? runs[runs.length - 1];
  const [jobsOpen, setJobsOpen] = useState(true);
  const jobs = runs.filter((r) => r.background);
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  return (
    <div className="run-console">
      <div className="run-tabs">
        {runs.map((r) => (
          <button key={r.id} className={'run-tab' + (selected?.id === r.id ? ' on' : '') + (r.owner === 'user' ? ' user' : '')} onClick={() => selectRun(session.id, r.id)} title={`${r.command} · ${r.runtime}`}>
            <span className={'rs ' + r.status} />{r.owner === 'user' ? '👤 ' : ''}<span className="rt-cmd">{r.command}</span>{r.port && <span className="tag">:{r.port}</span>}
          </button>
        ))}
        <button className="run-tab add" onClick={() => newTerminal(session.id)} title="New terminal (Ctrl+Alt+T)"><Plus size={12} /> terminal</button>
      </div>
      <div className="run-main">
        {selected ? (
          <>
            <div className="run-toolbar">
              <span className={'run-status s-' + selected.status}>{selected.status === 'running' ? <Radio size={12} className="pulse-soft" /> : selected.status === 'exited' ? <Circle size={12} /> : <Square size={12} />}{selected.status}</span>
              <span className="tag">{selected.runtime}</span>
              <span className="tag">{selected.preset}</span>
              {selected.port && <button className="chip-btn" onClick={() => setDockTab('preview')}><Play size={11} />Open preview :{selected.port}</button>}
              <span className="spacer" />
              <button className={'icon-btn sm' + (notify[selected.id] ? ' on' : '')} title="Notify when done" onClick={() => { setNotify((n) => ({ ...n, [selected.id]: !n[selected.id] })); toast(notify[selected.id] ? 'Notifications off for this job' : 'I will notify you when this job finishes', 'info'); }}>{notify[selected.id] ? <BellRing size={13} /> : <Bell size={13} />}</button>
              <button className="icon-btn sm" title="Save log" onClick={() => toast('Log saved to exports/' + selected.id + '.log', 'success')}><Save size={13} /></button>
              <button className="icon-btn sm" title="Restart" onClick={() => restartRun(session.id, selected.id)}><RotateCcw size={13} /></button>
              <button className="icon-btn sm danger" title="Kill" onClick={() => killRun(session.id, selected.id)} disabled={selected.status !== 'running'}><Square size={13} /></button>
            </div>
            <Terminal key={selected.id} session={session} run={selected} />
          </>
        ) : <EmptyTab icon={<TerminalIcon size={22} />} text="No runs yet" sub="Commands the agent runs — or a terminal you open — show up here." />}
      </div>
      {jobs.length > 0 && (
        <div className="jobs">
          <button className="jobs-head" onClick={() => setJobsOpen(!jobsOpen)}><Zap size={13} /><b>Background jobs</b><span className="muted">{jobs.filter((j) => j.status === 'running').length} running</span><span className="spacer" />{jobsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
          {jobsOpen && jobs.map((j) => (
            <div key={j.id} className={'job' + (selected?.id === j.id ? ' on' : '')} onClick={() => selectRun(session.id, j.id)}>
              <span className={'rs ' + j.status} /><span className="job-cmd">{j.command}</span>{j.port && <span className="tag">:{j.port}</span>}<span className="spacer" />
              <span className="job-last">{j.lines[j.lines.length - 1] ?? ''}</span>
              {j.status === 'running' ? <button className="chip-btn danger" onClick={(e) => { e.stopPropagation(); killRun(session.id, j.id); }}>Kill</button> : <button className="chip-btn" onClick={(e) => { e.stopPropagation(); restartRun(session.id, j.id); }}>Restart</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
