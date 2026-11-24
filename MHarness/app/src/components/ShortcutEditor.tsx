import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../state/useStore';
import { toast, updateSettings } from '../state/store';
import { chordFromEvent, chordToLabel, conflictsFor, effectiveChord, SHORTCUT_DEFS, type ShortcutDef } from '../state/shortcuts';

/** Editable keyboard map: record a chord, detect conflicts, reset one or all. */
export function ShortcutEditor() {
  const st = useStore();
  const overrides = st.settings.shortcuts ?? {};
  const [recording, setRecording] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string>('');
  useEffect(() => {
    if (!recording) return;
    const def = SHORTCUT_DEFS.find((d) => d.id === recording)!;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { setRecording(null); setConflict(''); return; }
      const chord = chordFromEvent(e, def.macControl ? 'secondary' : 'primary');
      if (!chord) return; // modifiers only
      const others = conflictsFor(def, chord, overrides);
      if (others.length) { setConflict(`Already used by ${others[0].label}`); return; }
      updateSettings({ shortcuts: { ...overrides, [def.id]: chord } });
      setRecording(null); setConflict('');
      toast(`${def.label} → ${chordToLabel(chord)}`, 'success');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, overrides]);
  const groups = ['Global', 'Session', 'Dock'] as const;
  const resetAll = () => { updateSettings({ shortcuts: {} }); toast('Shortcuts reset to defaults', 'info'); };
  return (
    <div className="sc-editor">
      <div className="sc-editor-head"><span className="set-sub">Click a chord to record a new one. Conflicts are rejected; Esc cancels.</span><span className="spacer" /><button className="chip-btn" onClick={resetAll} disabled={!Object.keys(overrides).length}><RotateCcw size={11} />Reset all</button></div>
      {groups.map((g) => (
        <div key={g} className="sc-group">
          <div className="sc-group-title">{g}</div>
          {SHORTCUT_DEFS.filter((d) => d.group === g).map((def) => (
            <ShortcutRow key={def.id} def={def} chord={effectiveChord(def, overrides)} custom={!!overrides[def.id]} recording={recording === def.id} conflict={recording === def.id ? conflict : ''} onRecord={() => { setRecording(def.id); setConflict(''); }} onReset={() => { const next = { ...overrides }; delete next[def.id]; updateSettings({ shortcuts: next }); }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ShortcutRow({ def, chord, custom, recording, conflict, onRecord, onReset }: { def: ShortcutDef; chord: string; custom: boolean; recording: boolean; conflict: string; onRecord: () => void; onReset: () => void }) {
  return (
    <div className={'sc-row' + (recording ? ' recording' : '') + (custom ? ' custom' : '')}>
      <span>{def.label}{conflict && <span className="sc-conflict"> — {conflict}</span>}</span>
      <span className="spacer" />
      {custom && <button className="icon-btn sm" title="Reset to default" onClick={onReset}><RotateCcw size={11} /></button>}
      <button className={'sc-chord' + (recording ? ' recording' : '')} onClick={onRecord} title={recording ? 'Press the new shortcut…' : 'Click to change'} aria-label={`Shortcut for ${def.label}`}>
        {recording ? 'Press keys…' : chord.split('+').map((p, i) => <kbd key={i}>{chordToLabel(p)}</kbd>)}
      </button>
    </div>
  );
}
