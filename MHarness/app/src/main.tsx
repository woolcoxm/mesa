import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seed, getState, renameSession, closeCanvas, closePublish, openPage, setActive, setDockFloating, togglePalette, newSessionAction, setDockTab, setMode, setPreset, updateSettings, toggleGallery, toggleDock, toggleRail, dismissShowcase, newTerminal, DOCK_TABS } from './state/store';
import { resolveShortcutEvent } from './state/shortcuts';
import './styles/tokens.css';
import './styles/app.css';

async function boot() {
  await seed();
  // Deep links: #/s/<session>/<tab> (or #/<page>) restore the active session and dock tab; the URL is kept in sync (no history spam).
  const applyHash = () => {
    const m = /^#\/s\/([\w-]+)(?:\/(\w+))?/.exec(location.hash);
    if (m) { const st = getState(); if (st.sessions.some((s) => s.id === m[1])) { setActive(m[1]); if (m[2] && DOCK_TABS.some((t) => t.id === m[2])) setDockTab(m[2] as typeof DOCK_TABS[number]['id']); return; } }
    const p = /^#\/(settings|plugins|automations)/.exec(location.hash); if (p) openPage(p[1] as 'settings');
  };
  applyHash();
  window.addEventListener('hashchange', applyHash);
  let lastUrl = '';
  import('./state/store').then(({ subscribe }) => subscribe(() => {
    const s = getState(); const session = s.sessions.find((x) => x.id === s.activeSessionId);
    const next = s.page === 'session' && session ? `#/s/${session.id}/${s.dock.tab}` : `#/${s.page}`;
    if (next !== lastUrl) { lastUrl = next; history.replaceState(null, '', next); }
  }));
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
    const typing = (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) && !t.classList.contains('xterm-helper-textarea');
    const st = getState();
    const session = st.sessions.find((s) => s.id === st.activeSessionId);
    if (e.code === 'Escape') {
      if (st.publish) return closePublish();
      if (st.palette.open) return togglePalette(false);
      if (st.gallery.open) return toggleGallery(false);
      if (session?.pendingApproval) return; // the approval takeover owns Esc (deny flow)
      if (st.showcase && !st.showcase.minimized) return dismissShowcase();
      if (st.canvasSplit && st.page === 'session') return closeCanvas();
      return;
    }
    // Dispatch through the editable shortcut table (Settings → Keyboard); chords are matched by physical key.
    const def = resolveShortcutEvent(e, st.settings.shortcuts ?? {});
    if (!def) return;
    if (typing && !def.whenTyping) return; // plain-text typing must reach the composer/terminal normally
    e.preventDefault();
    switch (def.id) {
      case 'palette': return togglePalette();
      case 'newSession': return newSessionAction();
      case 'rename': { if (session) { const v = prompt('Rename session', session.title); if (v && v.trim()) renameSession(session.id, v.trim()); } return; }
      case 'toggleRail': return toggleRail();
      case 'toggleDock': return toggleDock();
      case 'floatDock': return setDockFloating(!st.dock.floating);
      case 'gallery': return toggleGallery();
      case 'runConsole': return setDockTab('run');
      case 'newTerminal': if (session) newTerminal(session.id); return;
      case 'cycleMode': if (session) setMode(session.id, session.mode === 'plan' ? 'build' : session.mode === 'build' ? 'auto' : 'plan'); return;
      case 'cyclePreset': if (session) setPreset(session.id, session.preset === 'read-only' ? 'workspace-write' : session.preset === 'workspace-write' ? 'full-access' : 'read-only'); return;
      case 'dnd': return updateSettings({ dnd: !st.settings.dnd });
      default: { const m = /^tab([1-8])$/.exec(def.id); if (m) setDockTab(DOCK_TABS[Number(m[1]) - 1].id); }
    }
  }, true); // capture: xterm.js and inputs stopPropagation on keys they handle
}
boot();