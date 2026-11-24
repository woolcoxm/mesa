import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seed, getState, renameSession, setDockFloating, togglePalette, newSessionAction, setDockTab, setMode, setPreset, updateSettings, toggleGallery, toggleDock, toggleRail, dismissShowcase, newTerminal, DOCK_TABS } from './state/store';
import './styles/tokens.css';
import './styles/app.css';

async function boot() {
  await seed();
  createRoot(document.getElementById('root')!).render(<App />);
  // Live document title: "● working · <session> — Mesa" while the agent runs.
  let lastTitle = '';
  import('./state/store').then(({ subscribe, getState }) => {
    const updateTitle = () => {
      const s = getState(); const session = s.sessions.find((x) => x.id === s.activeSessionId);
      const busy = session?.state === 'running' || session?.state === 'awaiting';
      const pending = s.sessions.filter((x) => x.state === 'awaiting').length;
      const t = `${busy ? (session?.state === 'awaiting' ? '⏸ ' : '● ') : ''}${session?.title ?? 'Mesa'} — Mesa${pending ? ` (${pending} approval${pending === 1 ? '' : 's'})` : ''}`;
      if (t !== lastTitle) { lastTitle = t; document.title = t; }
    };
    subscribe(updateTitle);
    updateTitle();
  });
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable;
    if (e.key === 'F2' && !typing) { e.preventDefault(); const st = getState(); const session = st.sessions.find((s) => s.id === st.activeSessionId); if (session) { const v = prompt('Rename session', session.title); if (v && v.trim()) renameSession(session.id, v.trim()); } return; }
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      const s = getState();
      if (s.palette.open) return togglePalette(false);
      if (s.gallery.open) return toggleGallery(false);
      if (s.showcase && !s.showcase.minimized) return dismissShowcase();
      return;
    }
    if (!mod) return;
    const st = getState();
    const session = st.sessions.find((s) => s.id === st.activeSessionId);
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); togglePalette(); return; }
    if (typing && e.key !== 'Enter') return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newSessionAction(); return; }
    if (e.shiftKey && e.key === 'D') { e.preventDefault(); updateSettings({ dnd: !st.settings.dnd }); return; }
    if (e.shiftKey && e.key === 'G') { e.preventDefault(); toggleGallery(); return; }
    if (e.shiftKey && e.key === 'J') { e.preventDefault(); setDockTab('run'); return; }
    if (e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); setDockFloating(!st.dock.floating); return; }
    if (e.shiftKey && e.key === '\\') { e.preventDefault(); toggleDock(); return; }
    if (!e.shiftKey && e.key === '\\') { e.preventDefault(); toggleRail(); return; }
    if (e.altKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); if (session) newTerminal(session.id); return; }
    if (e.key === '.') { e.preventDefault(); if (session) setMode(session.id, session.mode === 'plan' ? 'build' : session.mode === 'build' ? 'auto' : 'plan'); return; }
    if (e.shiftKey && e.key === 'P') { e.preventDefault(); if (session) setPreset(session.id, session.preset === 'read-only' ? 'workspace-write' : session.preset === 'workspace-write' ? 'full-access' : 'read-only'); return; }
    const n = parseInt(e.key, 10);
    if (!e.shiftKey && n >= 1 && n <= DOCK_TABS.length) { e.preventDefault(); setDockTab(DOCK_TABS[n - 1].id); }
  });
}
boot();
