import { useState } from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import type { Session } from '../state/types';
import { send, toast } from '../state/store';
import { EmptyTab } from './Dock';

interface Entry { label: string; kind: 'app' | 'url'; url?: string; at: number }

/** A small framed browser: the session's latest app by default, plus any http(s) URL you type — with back/forward/reload and real navigation events. */
export function BrowserTab({ session }: { session: Session }) {
  const app = session.artifacts.find((a) => a.kind === 'app' && a.html);
  const [history, setHistory] = useState<Entry[]>([{ label: app ? `mesa://${app.title}` : 'about:blank', kind: 'app', at: Date.now() }]);
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState(app ? `mesa://${app.title}` : '');
  const [reloadKey, setReloadKey] = useState(0);
  const [events, setEvents] = useState<{ at: number; text: string }[]>([]);
  const current = history[Math.max(0, Math.min(index, history.length - 1))];
  const log = (text: string) => setEvents((e) => [...e.slice(-200), { at: Date.now(), text }]);
  const navigate = (entry: Entry) => { setHistory((h) => [...h.slice(0, index + 1), entry]); setIndex((i) => i + 1); setUrl(entry.label); setReloadKey((k) => k + 1); log(`→ ${entry.label}`); };
  const go = (delta: number) => { const n = index + delta; if (n < 0 || n >= history.length) return; setIndex(n); setUrl(history[n].label); setReloadKey((k) => k + 1); log(`${delta < 0 ? '←' : '→'} ${history[n].label}`); };
  const reload = () => { setReloadKey((k) => k + 1); log(`⟳ reload ${current.label}`); };
  const submitUrl = () => {
    const v = url.trim();
    if (!v) return;
    if (/^https?:\/\//i.test(v)) return navigate({ label: v, kind: 'url', url: v, at: Date.now() });
    if (/^mesa:\/\//i.test(v) || !v.includes('.')) { navigate({ label: app ? `mesa://${app.title}` : 'about:blank', kind: 'app', at: Date.now() }); return; }
    navigate({ label: 'https://' + v, kind: 'url', url: 'https://' + v, at: Date.now() });
  };
  const openExternal = () => {
    if (current.kind === 'url' && current.url) { window.open(current.url, '_blank', 'noopener'); return; }
    if (!app) return toast('Nothing to open yet', 'info');
    const blob = URL.createObjectURL(new Blob([app.html ?? ''], { type: 'text/html' }));
    window.open(blob, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(blob), 60_000);
    toast(`Opened ${app.title} in a new tab`, 'success');
  };
  if (!app && current.kind === 'app') return <div className="browser-tab"><EmptyTab icon={<Globe size={22} />} text="Nothing to browse" sub="Build an app and it appears here — or type a URL above once one exists." action={{ label: 'Build a dashboard app', run: () => send('Build a small flashy dashboard app with Vite') }} /></div>;
  return (
    <div className="browser-tab">
      <div className="browser-bar">
        <button className="icon-btn sm" title="Back" disabled={index <= 0} onClick={() => go(-1)}>‹</button>
        <button className="icon-btn sm" title="Forward" disabled={index >= history.length - 1} onClick={() => go(1)}>›</button>
        <button className="icon-btn sm" title="Reload" onClick={reload}>⟳</button>
        <div className="url"><Globe size={12} /><input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); }} aria-label="URL" placeholder="https://example.com or mesa://app" /></div>
        <button className="icon-btn sm" title={current.kind === 'url' ? 'Open in system browser' : 'Open the app in a new tab'} onClick={openExternal}><ExternalLink size={12} /></button>
      </div>
      <div className="browser-body">
        {current.kind === 'url' ? <iframe key={reloadKey} title="browser" sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" src={current.url} onLoad={() => log(`loaded ${current.label}`)} /> : <iframe key={reloadKey} title="browser" sandbox="allow-scripts" srcDoc={app?.html ?? ''} onLoad={() => log(`loaded ${current.label}`)} />}
      </div>
      <div className="browser-panel"><div className="bp-tabs"><span className="on">Navigation</span></div><div className="bp-body">{events.length === 0 && <div className="bp-log"><span className="lv">info</span>Type a URL above or use back / forward; framed sites may refuse to load (X-Frame-Options).</div>}{events.map((e, i) => <div key={i} className="bp-log"><span className="lv">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>{e.text}</div>)}</div></div>
    </div>
  );
}
