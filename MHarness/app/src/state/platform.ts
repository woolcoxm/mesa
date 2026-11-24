// Platform helpers: keyboard labels and shell-specific hints for macOS / Windows / Linux.
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const IS_WINDOWS = typeof navigator !== 'undefined' && /Win/.test(navigator.platform || navigator.userAgent);

export const MOD = IS_MAC ? '⌘' : 'Ctrl';
export const ALT = IS_MAC ? '⌥' : 'Alt';
/** Secondary chords (Ctrl+Shift+X) use the Control key on macOS so they don't collide with browser shortcuts like ⌘⇧J. */
export const SEC = IS_MAC ? '⌃' : 'Ctrl';

/** Render a shortcut string for this platform: sc('Ctrl+Shift+G') → '⌃⇧G' on macOS, unchanged elsewhere. */
export function sc(keys: string): string {
  if (!IS_MAC) return keys;
  if (/^Ctrl\+Shift/.test(keys)) return keys.replace(/Ctrl\+?/, '⌃').replace(/Shift\+?/, '⇧').replace(/Alt\+?/, '⌥');
  return keys.replace(/Ctrl\+?/g, '⌘').replace(/Shift\+?/g, '⇧').replace(/Alt\+?/g, '⌥');
}

/** Human name of the shell the live agent's bash tool will use on this machine (matches scripts/serve.mjs). */
export function shellName(): string {
  if (IS_WINDOWS) return 'cmd.exe';
  if (IS_MAC) return 'your $SHELL (zsh)';
  return 'your $SHELL (sh)';
}

// ---------- accent palettes (re-tint the whole UI; every component reads --mesa-accent*) ----------
export interface Accent { id: string; name: string; light: string; dark: string }
export const ACCENTS: Accent[] = [
  { id: 'indigo', name: 'Indigo', light: '#4f5bd9', dark: '#7c86ff' },
  { id: 'violet', name: 'Violet', light: '#7c3aed', dark: '#a78bfa' },
  { id: 'teal', name: 'Teal', light: '#0d9488', dark: '#2dd4bf' },
  { id: 'rose', name: 'Rose', light: '#e11d48', dark: '#fb7185' },
  { id: 'amber', name: 'Amber', light: '#d97706', dark: '#fbbf24' },
  { id: 'green', name: 'Green', light: '#16a34a', dark: '#4ade80' },
];
export const accentById = (id: string) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
function rgba(hex: string, alpha: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; }
/** Writes the accent variables for both themes; the active theme picks the right one via [data-theme]. */
export function applyAccent(id: string) {
  const a = accentById(id);
  let tag = document.getElementById('mesa-accent') as HTMLStyleElement | null;
  if (!tag) { tag = document.createElement('style'); tag.id = 'mesa-accent'; document.head.appendChild(tag); }
  // Appended after the app stylesheet, so it wins at equal specificity; inline root vars would not, because [data-theme] is a selector.
  tag.textContent = `:root { --mesa-accent: ${a.light}; --mesa-accent-soft: ${rgba(a.light, 0.12)}; --mesa-accent-glow: ${rgba(a.light, 0.35)}; }
[data-theme="dark"] { --mesa-accent: ${a.dark}; --mesa-accent-soft: ${rgba(a.dark, 0.16)}; --mesa-accent-glow: ${rgba(a.dark, 0.45)}; }`;
}
