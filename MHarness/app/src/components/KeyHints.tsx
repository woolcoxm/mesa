// Hold Ctrl/⌘ to reveal shortcut badges on elements carrying data-key (the modifier itself is implied).
import { useEffect } from 'react';

export function KeyHints() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.add('show-keys'); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.remove('show-keys'); };
    const blur = () => document.body.classList.remove('show-keys');
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur); };
  }, []);
  return null;
}
