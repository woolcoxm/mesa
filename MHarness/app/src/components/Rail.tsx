import { sc } from '../state/platform';
import { useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Bot, CalendarClock, Puzzle, Settings, ChevronDown, ChevronRight, PanelLeftClose, Layers, Sparkles, X,
} from 'lucide-react';
import { deleteSession, newSessionAction, openPage, setActive, setDockTab, setRailSearch, setSidebarWidth, renameSession, toggleGroup, toggleRail, toggleGallery, togglePalette } from '../state/store';
import type { Id, Session } from '../state/types';
import { useStore } from '../state/useStore';

const GROUPS = ['Today', 'Yesterday', 'This week', 'Project: mesa'];

function timeAgo(ts: number) {
  const d = Date.now() - ts; const m = Math.round(d / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`; return `${Math.round(h / 24)}d`;
}

function StateDot({ s }: { s: Session }) {
  const cls = s.state === 'running' ? 'dot running' : s.state === 'awaiting' ? 'dot awaiting' : s.hasDeliverables ? 'dot delivered' : 'dot idle';
  return <span className={cls} title={s.state === 'awaiting' ? 'Awaiting approval' : s.state === 'running' ? 'Running' : s.hasDeliverables ? 'Has deliverables' : 'Idle'} />;
}

export function Rail({ forceCollapsed = false }: { forceCollapsed?: boolean }) {
  const st = useStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ id: Id; top: number } | null>(null);
  const peekTimer = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const open = st.rail.open && !forceCollapsed && st.settings.sidebarWidth > 80;
  const filtered = useMemo(() => {
    const q = st.rail.search.trim().toLowerCase();
    if (!q) return st.sessions;
    // Match the title, or any user message / agent answer in the session (content search across sessions).
    return st.sessions.filter((s) => s.title.toLowerCase().includes(q) || s.turns.some((t) => t.user.toLowerCase().includes(q) || t.blocks.some((b) => b.type === 'text' && b.text.toLowerCase().includes(q))));
  }, [st.sessions, st.rail.search]);

  const grouped = useMemo(() => {
    const m: Record<string, Session[]> = {};
    for (const s of filtered) (m[s.group] ??= []).push(s);
    return m;
  }, [filtered]);

  return (
    <div ref={railRef} className={'rail' + (open ? '' : ' collapsed')} style={{ width: open ? st.settings.sidebarWidth : 56 }}>
      <div className="rail-top">
        <button className="ws-btn" title="Switch workspace (Ctrl+Shift+W)">
          <span className="ws-mark">M</span>
          {open && <><span className="ws-name">mesa-demo</span><ChevronDown size={14} /></>}
        </button>
        <button className="icon-btn" data-key="\" title="Toggle rail (Ctrl+\)" onClick={toggleRail}><PanelLeftClose size={16} /></button>
      </div>
      {open && (
        <button className="new-btn" data-key="N" onClick={newSessionAction} title="New session (Ctrl+N)"><Plus size={16} /><span>New session</span><kbd>N</kbd></button>
      )}
      <div className="rail-search">
        <Search size={14} />
        <input placeholder="Search sessions & messages" value={st.rail.search} onChange={(e) => setRailSearch(e.target.value)} aria-label="Search sessions" />
        <kbd>{sc('Ctrl+K')}</kbd>
      </div>
      <div className="rail-sessions" role="tree" aria-label="Sessions">
        {GROUPS.filter((g) => grouped[g]).map((g) => (
          <div key={g} className="rail-group">
            <button className="group-head" onClick={() => toggleGroup(g)} aria-expanded={!st.rail.collapsed[g]}>
              {st.rail.collapsed[g] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <span>{g}</span><span className="count">{grouped[g].length}</span>
            </button>
            {!st.rail.collapsed[g] && grouped[g].map((s) => (
              <div key={s.id} className={'session-row' + (s.id === st.activeSessionId ? ' active' : '')} role="treeitem" aria-selected={s.id === st.activeSessionId} tabIndex={0}
                onClick={() => setActive(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActive(s.id); }} onDoubleClick={() => setRenaming(s.id)}
                onMouseEnter={(e) => { if (peekTimer.current) clearTimeout(peekTimer.current); const top = e.currentTarget.getBoundingClientRect().top; peekTimer.current = window.setTimeout(() => setPeek({ id: s.id, top }), 450); }}
                onMouseLeave={() => { if (peekTimer.current) clearTimeout(peekTimer.current); setPeek(null); }}>
                <StateDot s={s} />
                {renaming === s.id ? (
                  <input autoFocus className="rename" defaultValue={s.title} onBlur={(e) => { renameSession(s.id, (e.target as HTMLInputElement).value); setRenaming(null); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                ) : (<><span className="s-title">{s.title}</span><span className="s-time">{timeAgo(s.updatedAt)}</span><button className="s-del" title="Delete session" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${s.title}"?`)) deleteSession(s.id); }}><X size={12} /></button></>)}
                {peek?.id === s.id && s.turns.length > 0 && (
                  <div className="peek rail-peek" role="tooltip" style={{ top: Math.min(peek.top, window.innerHeight - 190) }}>
                    <div className="peek-head"><span className={'rs ' + (s.state === 'running' ? 'running' : s.state === 'awaiting' ? 'awaiting' : 'exited')} />{s.title}</div>
                    <div className="rp-q">{s.turns[s.turns.length - 1].user}</div>
                    {(() => { const last = [...s.turns].reverse().find((t) => t.blocks.some((b) => b.type === 'text' && b.text))?.blocks.filter((b) => b.type === 'text').map((b) => (b as Extract<typeof b, { type: 'text' }>).text).join(' ') ?? ''; return last ? <div className="rp-a">{last}</div> : null; })()}
                    <div className="rp-meta">{s.turns.length} turn{s.turns.length === 1 ? '' : 's'} · {s.artifacts.length} artifact{s.artifacts.length === 1 ? '' : 's'}{s.artifacts.some((a) => a.pinned) ? ' · pinned' : ''}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {!filtered.length && <div className="rail-empty">No sessions match "{st.rail.search}".</div>}
      </div>
      <div className="rail-nav">
        <button className={'nav-row' + (st.dock.tab === 'agents' ? ' on' : '')} onClick={() => { openPage('session'); setDockTab('agents'); }}><Bot size={16} /><span>Agents</span><span className="count">{st.sessions.reduce((n, s) => n + s.agents.length, 0) || ''}</span></button>
        <button className={'nav-row' + (st.page === 'automations' ? ' on' : '')} onClick={() => openPage('automations')}><CalendarClock size={16} /><span>Automations</span></button>
        <button className={'nav-row'} data-key={sc('Shift+G')} onClick={() => toggleGallery(true)}><Layers size={16} /><span>Gallery</span><span className="count">{st.sessions.reduce((n, s) => n + s.artifacts.filter((a) => a.pinned).length, 0) || ''}</span></button>
        <button className={'nav-row' + (st.page === 'plugins' ? ' on' : '')} onClick={() => openPage('plugins')}><Puzzle size={16} /><span>Plugins & Skills</span></button>
        <button className={'nav-row'} data-key="K" onClick={() => togglePalette(true)}><Sparkles size={16} /><span>Commands</span><kbd>{sc('Ctrl+K')}</kbd></button>
      </div>
      <div className="rail-bottom">
        <button className={'nav-row' + (st.page === 'settings' ? ' on' : '')} onClick={() => openPage('settings')}><Settings size={16} /><span>Settings</span></button>
      </div>
      <ResizeHandle />
    </div>
  );
}

function ResizeHandle() {
  const st = useStore();
  return (
    <div className="rail-resize" onPointerDown={(e) => {
      e.preventDefault();
      const el = e.currentTarget; el.setPointerCapture(e.pointerId);
      const startX = e.clientX; const startW = st.settings.sidebarWidth;
      document.body.classList.add('resizing');
      const move = (ev: PointerEvent) => setSidebarWidth(startW + ev.clientX - startX);
      const up = (ev: PointerEvent) => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('lostpointercapture', up); if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId); document.body.classList.remove('resizing'); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('lostpointercapture', up);
    }} title="Drag to resize" />
  );
}

export function EmptyRail() { return null; }
export { timeAgo };