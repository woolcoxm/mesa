import { useSyncExternalStore } from 'react';
import { getState, subscribe } from './store';

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useActiveSession(): import('./types').Session | undefined {
  const s = useStore();
  return s.sessions.find((x) => x.id === s.activeSessionId);
}
