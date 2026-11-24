import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seed, getState, renameSession, closeCanvas, setDockFloating, togglePalette, newSessionAction, setDockTab, setMode, setPreset, updateSettings, toggleGallery, toggleDock, toggleRail, dismissShowcase, newTerminal, DOCK_TABS } from './state/store';
import { IS_MAC } from './state/platform';
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
    const typing = (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) && !t.classList.contains('xterm-helper-textarea');
    // Use e.code (physical key) so shortcuts work on every keyboard layout and on macOS, where Option+A types "å".
    const code = e.code;
    if (code === 'F2' && !typing) { e.preventDefault(); const st = getState(); const session = st.sessions.find((s) => s.id === st.activeSessionId); if (session) { const v = prompt('Rename session', session.title); if (v && v.trim()) renameSession(session.id, v.trim()); } return; }
    const mod = e.ctrlKey || e.metaKey;
    const sec = IS_MAC ? e.ctrlKey : mod; // secondary chords use Control on macOS (⌘⇧J/⌘⇧D belong to the browser)
    if (code === 'Escape') {
      const s = getState();
      if (s.palette.open) return togglePalette(false);
      if (s.gallery.open) return toggleGallery(false);
      const session = s.sessions.find((x) => x.id === s.activeSessionId);
      if (session?.pendingApproval) return; // the approval takeover owns Esc (deny flow)
      if (s.showcase && !s.showcase.minimized) return dismissShowcase();
      if (s.canvasSplit && s.page === 'session') return closeCanvas();
      return;
    }
    if (!mod) return;
    const st = getState();
    const session = st.sessions.find((s) => s.id === st.activeSessionId);
    if (code === 'KeyK') { e.preventDefault(); togglePalette(); return; }
    if (typing && code !== 'Enter') return;
    if (code === 'KeyN') { e.preventDefault(); newSessionAction(); return; }
    if (e.shiftKey && sec && code === 'KeyD') { e.preventDefault(); updateSettings({ dnd: !st.settings.dnd }); return; }
    if (e.shiftKey && sec && code === 'KeyG') { e.preventDefault(); toggleGallery(); return; }
    if (e.shiftKey && sec && code === 'KeyJ') { e.preventDefault(); setDockTab('run'); return; }
    if (e.shiftKey && sec && code === 'KeyF') { e.preventDefault(); setDockFloating(!st.dock.floating); return; }
    if (e.shiftKey && code === 'Backslash') { e.preventDefault(); toggleDock(); return; }
    if (!e.shiftKey && code === 'Backslash') { e.preventDefault(); toggleRail(); return; }
    if (e.altKey && code === 'KeyT') { e.preventDefault(); if (session) newTerminal(session.id); return; }
    if (code === 'Period') { e.preventDefault(); if (session) setMode(session.id, session.mode === 'plan' ? 'build' : session.mode === 'build' ? 'auto' : 'plan'); return; }
    if (e.shiftKey && sec && code === 'KeyP') { e.preventDefault(); if (session) setPreset(session.id, session.preset === 'read-only' ? 'workspace-write' : session.preset === 'workspace-write' ? 'full-access' : 'read-only'); return; }
    const digit = /^Digit([1-8])$/.exec(code);
    if (!e.shiftKey && digit) { e.preventDefault(); setDockTab(DOCK_TABS[Number(digit[1]) - 1].id); }
  }, true); // capture: xterm.js and inputs stopPropagation on keys they handle
  // Plain-text typing must still reach the composer/terminal normally; Ctrl-combos are global by design.
}
boot();
