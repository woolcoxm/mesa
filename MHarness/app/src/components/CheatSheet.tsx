import { useFocusTrap } from './useFocusTrap';
import { X, Search } from 'lucide-react';
import { useState } from 'react';
import { chordToLabel, effectiveChord, SHORTCUT_DEFS } from '../state/shortcuts';
import { useStore } from '../state/useStore';
import { closeCheat } from '../state/store';
import { MOD } from '../state/platform';
import { startTour } from './Tour';

/** Press ? anywhere: a searchable cheat sheet of every shortcut (respects user overrides). */
export function CheatSheet() {
  const st = useStore();
  const [q, setQ] = useState('');
  const trap = useFocusTrap<HTMLDivElement>(!!st.cheat);
  if (!st.cheat) return null;
  const overrides = st.settings.shortcuts ?? {};
  const groups = ['Global', 'Session', 'Dock'] as const;
  const query = q.trim().toLowerCase();
  const matches = (label: string) => !query || label.toLowerCase().includes(query);
  return (
    <div className="overlay cheat-overlay" role="dialog" aria-label="Keyboard shortcuts" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCheat(); }}>
      <div className="cheat" ref={trap}>
        <div className="cheat-head"><kbd>?</kbd><b>Keyboard shortcuts</b><span className="muted">matched by physical key · editable in Settings → Keyboard</span><span className="spacer" /><div className="rail-search inline"><Search size={13} /><input autoFocus placeholder="Filter shortcuts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter shortcuts" /></div><button className="icon-btn" onClick={closeCheat} title="Close (Esc)"><X size={16} /></button></div>
        <div className="cheat-body">
          {groups.map((g) => {
            const defs = SHORTCUT_DEFS.filter((d) => d.group === g && matches(d.label));
            if (!defs.length) return null;
            return <div key={g} className="cheat-group"><div className="cheat-group-title">{g}</div>{defs.map((d) => <div key={d.id} className="cheat-row"><span>{d.label}</span><span className="spacer" /><span className="cheat-chord">{effectiveChord(d, overrides).split('+').map((p, i) => <kbd key={i}>{chordToLabel(p)}</kbd>)}</span></div>)}</div>;
          })}
          {!SHORTCUT_DEFS.some((d) => matches(d.label)) && <div className="menu-empty">No shortcut matches "{q}"</div>}
        </div>
        <div className="cheat-foot"><span className="set-sub">Tip: hold {MOD} to see shortcuts on the controls themselves.</span><span className="spacer" /><button className="chip-btn" onClick={() => { closeCheat(); startTour(); }}>Replay tour</button></div>
      </div>
    </div>
  );
}
