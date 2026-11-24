import { useEffect } from 'react';
import { Rail } from './components/Rail';
import { Header, DockTabs } from './components/Header';
import { Thread } from './components/Thread';
import { Composer } from './components/Composer';
import { ArtifactsTab, FilesTab, AgentsTab, StatsTab, TimelineTab, BrowserTab, PreviewTab, EmptyTab } from './components/Dock';
import { RunConsole } from './components/RunConsole';
import { Showcase, TrayStack, DndBanner } from './components/Showcase';
import { Palette } from './components/Palette';
import { Gallery } from './components/Gallery';
import { Toasts, SettingsPage, PluginsPage, AutomationsPage } from './components/Pages';
import { Confetti } from './components/Confetti';
import { useStore } from './state/useStore';
import { dismissShowcase, setDockFloating, setDockWidth, toggleGallery, togglePalette } from './state/store';
import { Sparkles } from 'lucide-react';

export function App() {
  const st = useStore();
  const session = st.sessions.find((s) => s.id === st.activeSessionId);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = st.settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : st.settings.theme; };
    apply();
    mq.addEventListener('change', apply);
    document.documentElement.dataset.density = st.settings.density;
    return () => mq.removeEventListener('change', apply);
  }, [st.settings.theme, st.settings.density]);
  const jobs = session?.runs.filter((r) => r.status === 'running' && r.background).length ?? 0;
  const glow = !!st.showcase?.minimized;
  return (
    <div className={'app' + (st.dock.open ? '' : ' no-dock') + (st.dock.floating ? ' dock-float' : '')} style={{ ['--dock-w' as string]: st.dock.open ? `${st.settings.dockWidth}%` : '0px', ['--sidebar-w' as string]: `${st.rail.open ? st.settings.sidebarWidth : 44}px` }}>
      <Rail />
      <main className="center" key={st.page === 'session' ? session?.id ?? 'none' : st.page}>
        {st.page === 'settings' ? <SettingsPage /> : st.page === 'plugins' ? <PluginsPage /> : st.page === 'automations' ? <AutomationsPage /> : session && (
          <>
            <Header session={session} />
            <Thread session={session} />
            <Composer session={session} />
          </>
        )}
        {!session && <div className="empty-thread">No session</div>}
      </main>
      {st.dock.open && (
        <aside className="dock" aria-label="Right dock">
          <div className="dock-head"><DockTabs /><div className="dock-tools"><span className="muted" style={{ fontSize: 11 }}>{jobs ? `⚡ ${jobs}` : ''}</span><button className="icon-btn sm" title="Float / unfloat (Ctrl+Shift+F)" onClick={() => setDockFloating(!st.dock.floating)}>⧉</button>{glow && <span className="hdr-glow" />}</div></div>
          <div className="dock-body">{session && (st.dock.tab === 'artifacts' ? <ArtifactsTab session={session} /> : st.dock.tab === 'run' ? <RunConsole session={session} /> : st.dock.tab === 'preview' ? <PreviewTab session={session} /> : st.dock.tab === 'files' ? <FilesTab session={session} /> : st.dock.tab === 'agents' ? <AgentsTab session={session} /> : st.dock.tab === 'stats' ? <StatsTab session={session} /> : st.dock.tab === 'timeline' ? <TimelineTab session={session} /> : <BrowserTab session={session} />)}</div>
          <div className="dock-resize" onPointerDown={(e) => {
            e.preventDefault();
            const startX = e.clientX; const startW = st.settings.dockWidth; const vw = window.innerWidth;
            const move = (ev: PointerEvent) => setDockWidth(startW + ((startX - ev.clientX) / vw) * 100);
            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('resizing'); };
            document.body.classList.add('resizing'); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
          }} />
        </aside>
      )}
      {glow && session && <div className="glow-chip"><Sparkles size={12} /> {st.sessions.find((s) => s.id === st.showcase?.sessionId)?.turns.find((t) => t.id === st.showcase?.turnId)?.deliverables.length ?? 0} deliverables docked</div>}
      <Showcase />
      <Confetti />
      <TrayStack />
      <Toasts />
      <Palette />
      <Gallery />
    </div>
  );
}
