import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab/Shift+Tab inside a dialog (moving focus in when it opens) and restores focus to the element that had it when the dialog closes. */
export function useFocusTrap<T extends HTMLElement>(active: boolean): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!active) return;
    const root = ref.current; if (!root) return;
    const previously = document.activeElement as HTMLElement | null;
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null && !el.closest('[data-focus-skip]'));
    const firstTarget = () => (root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? root);
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    // Move focus into the dialog on the next frame (after autoFocus inputs have mounted).
    const t = window.setTimeout(() => { if (!root.contains(document.activeElement)) firstTarget().focus(); }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const activeEl = document.activeElement as HTMLElement | null;
      if (!activeEl || !root.contains(activeEl)) { e.preventDefault(); (e.shiftKey ? items[items.length - 1] : items[0]).focus(); return; }
      if (e.shiftKey && activeEl === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && activeEl === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    };
    const onFocusIn = (e: FocusEvent) => { if (!root.contains(e.target as Node)) { e.stopPropagation(); firstTarget().focus(); } };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey, true); document.removeEventListener('focusin', onFocusIn, true); try { previously?.focus?.(); } catch { /* ignore */ } };
  }, [active]);
  return ref;
}
