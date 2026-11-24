import { useSyncExternalStore } from 'react';
import { getState, subscribe } from './store';

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useActiveSession(): import('./types').Session | undefined {
  const s = useStore();
  return s.sessions.find((x) => x.id === s.activeSessionId);
}
export function useNarrow(max = 960) {
  const query = '(max-width: ' + max + 'px)';
  return useSyncExternalStore(
    (cb) => { const mq = window.matchMedia(query); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}