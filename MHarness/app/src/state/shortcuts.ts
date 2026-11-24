// Shortcut definitions, chord normalisation and resolution. Chords look like "Control+Shift+KeyG" (modifiers in fixed order + e.code).
import { IS_MAC, sc } from './platform';

export interface ShortcutDef { id: string; label: string; def: string; group: 'Global' | 'Session' | 'Dock' | 'Approval'; whenTyping?: boolean; macControl?: boolean }

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'palette', label: 'Command palette', def: 'Control+KeyK', group: 'Global', whenTyping: true },
  { id: 'newSession', label: 'New session', def: 'Control+KeyN', group: 'Session' },
  { id: 'rename', label: 'Rename session', def: 'F2', group: 'Session' },
  { id: 'toggleRail', label: 'Toggle left rail', def: 'Control+Backslash', group: 'Global' },
  { id: 'toggleDock', label: 'Toggle right dock', def: 'Control+Shift+Backslash', group: 'Global', macControl: true },
  { id: 'floatDock', label: 'Float / unfloat dock tab', def: 'Control+Shift+KeyF', group: 'Dock', macControl: true },
  { id: 'gallery', label: 'Gallery', def: 'Control+Shift+KeyG', group: 'Global', macControl: true },
  { id: 'runConsole', label: 'Run console', def: 'Control+Shift+KeyJ', group: 'Dock', macControl: true },
  { id: 'newTerminal', label: 'New terminal', def: 'Alt+Control+KeyT', group: 'Dock' },
  { id: 'cycleMode', label: 'Cycle mode', def: 'Control+Period', group: 'Session' },
  { id: 'cyclePreset', label: 'Cycle permission preset', def: 'Control+Shift+KeyP', group: 'Session', macControl: true },
  { id: 'dnd', label: 'Do not disturb', def: 'Control+Shift+KeyD', group: 'Global', macControl: true },
  { id: 'tab1', label: 'Dock tab · Artifacts', def: 'Control+Digit1', group: 'Dock' },
  { id: 'tab2', label: 'Dock tab · Run console', def: 'Control+Digit2', group: 'Dock' },
  { id: 'tab3', label: 'Dock tab · Preview', def: 'Control+Digit3', group: 'Dock' },
  { id: 'tab4', label: 'Dock tab · Files & diffs', def: 'Control+Digit4', group: 'Dock' },
  { id: 'tab5', label: 'Dock tab · Agents', def: 'Control+Digit5', group: 'Dock' },
  { id: 'tab6', label: 'Dock tab · Stats', def: 'Control+Digit6', group: 'Dock' },
  { id: 'tab7', label: 'Dock tab · Timeline', def: 'Control+Digit7', group: 'Dock' },
  { id: 'tab8', label: 'Dock tab · Browser', def: 'Control+Digit8', group: 'Dock' },
];

const MOD_ORDER = ['Control', 'Shift', 'Alt', 'Meta'];
const KEY_LABEL: Record<string, string> = { Backslash: '\\', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Space: 'Space', Enter: 'Enter', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

/** Normalise a key event to a chord string; returns '' if only modifier keys are pressed.
 *  kind: 'primary' chords use Cmd on macOS / Ctrl elsewhere; 'secondary' chords (macControl defs) use Ctrl on macOS so they avoid browser ⌘⇧ shortcuts. */
export function chordFromEvent(e: KeyboardEvent, kind: 'primary' | 'secondary' = 'primary'): string {
  const ctrl = IS_MAC ? (kind === 'secondary' ? e.ctrlKey : e.metaKey) : (e.ctrlKey || e.metaKey);
  const parts: string[] = [];
  if (ctrl) parts.push('Control');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const code = e.code;
  if (!code || /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(code)) return '';
  return [...parts, code].join('+');
}

/** Normalise a stored/edited chord string (sorts modifiers, trims). */
export function normalizeChord(chord: string): string {
  const parts = chord.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.filter((p) => !MOD_ORDER.includes(p));
  const mods = MOD_ORDER.filter((m) => parts.includes(m));
  return [...mods, ...key].join('+');
}

export function chordToLabel(chord: string): string {
  const parts = normalizeChord(chord).split('+');
  const out: string[] = [];
  for (const p of parts) {
    if (p === 'Control') out.push('Ctrl');
    else if (p === 'Meta') out.push('Win');
    else if (p === 'Shift') out.push('Shift');
    else if (p === 'Alt') out.push('Alt');
    else if (/^Key[A-Z]$/.test(p)) out.push(p.slice(3));
    else if (/^Digit\d$/.test(p)) out.push(p.slice(5));
    else if (/^F\d{1,2}$/.test(p)) out.push(p);
    else out.push(KEY_LABEL[p] ?? p);
  }
  return sc(out.join('+'));
}

export type ShortcutOverrides = Record<string, string>;

export function effectiveChord(def: ShortcutDef, overrides: ShortcutOverrides): string {
  return normalizeChord(overrides[def.id] ?? def.def);
}

/** Find the action a key event triggers, considering user overrides and the macOS primary/secondary rule. */
export function resolveShortcutEvent(e: KeyboardEvent, overrides: ShortcutOverrides): ShortcutDef | undefined {
  const primary = chordFromEvent(e, 'primary');
  const secondary = IS_MAC ? chordFromEvent(e, 'secondary') : primary;
  if (!primary && !secondary) return undefined;
  return SHORTCUT_DEFS.find((d) => effectiveChord(d, overrides) === (d.macControl ? secondary : primary));
}

/** Other actions that already use this chord (for conflict detection). */
export function conflictsFor(def: ShortcutDef, chord: string, overrides: ShortcutOverrides): ShortcutDef[] {
  return SHORTCUT_DEFS.filter((d) => d.id !== def.id && effectiveChord(d, overrides) === chord);
}
