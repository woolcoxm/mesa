import { useFocusTrap } from './useFocusTrap';
import { startTour } from './Tour';
import { sc } from '../state/platform';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Moon, Sun, PanelRight, Layers, BellOff, PanelLeft, Sparkles, AppWindow, ChartColumn, TestTube2, GitBranch, Keyboard, Settings, Puzzle, CalendarClock, Cpu, Zap, Command } from 'lucide-react';
import { exportSession, newSessionAction, openPage, send, setDockTab, setMode, toggleDock, toggleGallery, togglePalette, toggleRail, updateSettings, DOCK_TABS, setActive, newTerminal, openBesideChat, openCheat, openPublish, pinArtifact } from '../state/store';
import { useStore } from '../state/useStore';
import { ACCENTS } from '../state/platform';

type Cmd = { id: string; t: string; k: string; icon: typeof Plus; run: () => void; disabled?: boolean; indent?: boolean };

export function Palette() {
  const st = useStore();
  const trap = useFocusTrap<HTMLDivElement>(st.palette.open);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const open = st.palette.open;
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  const close = () => togglePalette(false);
  const session = st.sessions.find((s) => s.id === st.activeSessionId);

  const commands = useMemo(() => {
    const dark = st.settings.theme === 'dark' || (st.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const base: Cmd[] = [
      { id: 'new', t: 'New session', k: sc('Ctrl+N'), icon: Plus, run: () => newSessionAction() },
      { id: 'theme', t: dark ? 'Switch to light theme' : 'Switch to dark theme', k: '', icon: dark ? Sun : Moon, run: () => updateSettings({ theme: dark ? 'light' : 'dark' }) },
      { id: 'dnd', t: st.settings.dnd ? 'Turn off do-not-disturb' : 'Do not disturb (dock showcases silently)', k: sc('Ctrl+Shift+D'), icon: BellOff, run: () => { updateSettings({ dnd: !st.settings.dnd }); } },
      { id: 'rail', t: 'Toggle left rail', k: sc('Ctrl+\\'), icon: PanelLeft, run: toggleRail },
      { id: 'dock', t: 'Toggle right dock', k: sc('Ctrl+Shift+\\'), icon: PanelRight, run: toggleDock },
      { id: 'gallery', t: 'Open Gallery', k: sc('Ctrl+Shift+G'), icon: Layers, run: () => toggleGallery(true) },
      ...DOCK_TABS.map((t) => ({ id: 'tab-' + t.id, t: 'Open · ' + t.label, k: sc('Ctrl+' + t.key), icon: t.id === 'preview' ? AppWindow : t.id === 'agents' ? GitBranch : t.id === 'stats' ? Cpu : t.id === 'run' ? Zap : Sparkles, run: () => setDockTab(t.id) })),
      { id: 'settings', t: 'Open Settings', k: '', icon: Settings, run: () => openPage('settings') },
      { id: 'tour', t: 'Replay the guided tour', k: '', icon: Sparkles, run: () => startTour() },
      { id: 'cheat', t: 'Keyboard cheat sheet', k: '?', icon: Keyboard, run: () => openCheat() },
      ...ACCENTS.map((a) => ({ id: 'accent-' + a.id, t: 'Accent · ' + a.name, k: '', icon: Sparkles, run: () => updateSettings({ accent: a.id }) })),
      ...(['comfortable', 'compact', 'terminal'] as const).map((d) => ({ id: 'density-' + d, t: 'Density · ' + d, k: '', icon: Sparkles, run: () => updateSettings({ density: d }) })),
      { id: 'plugins', t: 'Open Plugins & Skills', k: '', icon: Puzzle, run: () => openPage('plugins') },
      { id: 'autos', t: 'Open Automations', k: '', icon: CalendarClock, run: () => openPage('automations') },
    ];
    if (session) {
      base.push({ id: 'export', t: 'Export session · JSONL ledger', k: '', icon: Sparkles, run: () => exportSession(session.id, 'jsonl') });
      const latest = [...session.artifacts].reverse();
      const latestVisual = latest.find((a) => a.html || a.kind === 'chart' || a.notebook);
      const latestHtml = latest.find((a) => a.html);
      const latestAny = latest[0];
      base.push({ id: 'terminal', t: 'New terminal', k: sc('Ctrl+Alt+T'), icon: Zap, run: () => { newTerminal(session.id); setDockTab('run'); } });
      if (latestAny) base.push({ id: 'pin-latest', t: 'Pin · ' + latestAny.title + ' → Gallery', k: '', icon: Sparkles, run: () => pinArtifact(session.id, latestAny.id) });
      if (latestVisual) base.push({ id: 'beside-latest', t: 'Beside chat · ' + latestVisual.title, k: '', icon: Sparkles, run: () => openBesideChat(session.id, latestVisual.id) });
      if (latestHtml) base.push({ id: 'publish-latest', t: 'Publish · ' + latestHtml.title, k: '', icon: Sparkles, run: () => openPublish(session.id, latestHtml.id) });
      if (new URLSearchParams(location.search).has('debug')) base.push({ id: 'crash-thread', t: 'Debug · crash the conversation pane (tests the error boundary)', k: '', icon: Sparkles, run: () => { (window as unknown as { __mesaCrashThread?: boolean }).__mesaCrashThread = true; updateSettings({}); } });
      base.push({ id: 'plan', t: 'Mode · Plan', k: sc('Ctrl+.'), icon: Keyboard, run: () => setMode(session.id, 'plan') });
      base.push({ id: 'build', t: 'Mode · Build', k: '', icon: Keyboard, run: () => setMode(session.id, 'build') });
      base.push({ id: 'auto', t: 'Mode · Auto', k: '', icon: Keyboard, run: () => setMode(session.id, 'auto') });
      if (session.state !== 'running') {
        base.push({ id: 'demo-app', t: 'Demo · Build a dashboard app', k: '', icon: AppWindow, run: () => send('Build a small flashy dashboard app with Vite') });
        base.push({ id: 'demo-chart', t: 'Demo · Analyse revenue → chart', k: '', icon: ChartColumn, run: () => send('Analyse the revenue data and make a chart') });
        base.push({ id: 'demo-test', t: 'Demo · Run tests and fix failures', k: '', icon: TestTube2, run: () => send('Run the tests and fix whatever fails') });
        base.push({ id: 'demo-refactor', t: 'Demo · Refactor with subagents', k: '', icon: GitBranch, run: () => send('Refactor: rename Series to TimeSeries across the repo') });
      }
      base.push({ id: 'sessions', t: 'Sessions', k: '', icon: Sparkles, run: () => {}, disabled: true });
      st.sessions.slice(0, 6).forEach((s) => base.push({ id: 's-' + s.id, t: 'Go to · ' + s.title, k: '', icon: Sparkles, run: () => setActive(s.id), indent: true }));
    }
    const lower = q.toLowerCase();
    return base.filter((c) => !c.disabled || q === '').filter((c) => !lower || c.t.toLowerCase().includes(lower));
  }, [q, st.settings.theme, st.settings.dnd, st.sessions, session]);

  const run = (c: (typeof commands)[number]) => { close(); c.run(); };
  useEffect(() => { setIdx(0); }, [q]);
  if (!open) return null;
  return (
    <div className="overlay palette-overlay" onMouseDown={close}>
      <div className="palette" ref={trap} role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input"><Search size={16} /><input ref={input} placeholder="Type a command or search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(commands.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (commands[idx]) run(commands[idx]); }
          else if (e.key === 'Escape') close();
        }} /><kbd>esc</kbd></div>
        <div className="palette-list" role="listbox">
          {commands.map((c, i) => { const Icon = c.icon; return <button key={c.id} className={'pal-item' + (i === idx ? ' on' : '') + (c.indent ? ' indent' : '')} onMouseEnter={() => setIdx(i)} onClick={() => run(c)} role="option" aria-selected={i === idx}><Icon size={14} /><span>{c.t}</span><span className="spacer" />{c.k && <kbd>{c.k}</kbd>}</button>; })}
          {!commands.length && <div className="menu-empty">No matching commands</div>}
        </div>
        <div className="palette-foot"><Command size={11} /> Mesa commands · <kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> run</div>
      </div>
    </div>
  );
}
