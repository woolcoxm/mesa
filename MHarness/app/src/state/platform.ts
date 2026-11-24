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
