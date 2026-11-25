import { useFocusTrap } from './useFocusTrap';
import { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertTriangle, OctagonAlert, Link2, Copy, ExternalLink, Trash2, Sparkles, Check } from 'lucide-react';
import { useStore } from '../state/useStore';
import { closePublish, insertIntoComposer, toast } from '../state/store';
import { listPublished, preflight, publishHtml, unpublish, type PreflightIssue } from '../agent/publish';

/** Publish an HTML artifact to a local URL after a preflight scan (secrets, source maps, external scripts). */
export function PublishDialog() {
  const st = useStore();
  const trap = useFocusTrap<HTMLDivElement>(!!st.publish);
  const target = st.publish;
  const session = target ? st.sessions.find((s) => s.id === target.sessionId) : undefined;
  const artifact = target ? session?.artifacts.find((a) => a.id === target.artifactId) : undefined;
  const [issues, setIssues] = useState<PreflightIssue[]>([]);
  const [result, setResults] = useState<{ url?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<{ id: string; url: string }[]>([]);
  useEffect(() => {
    if (!artifact?.html) return;
    setIssues(preflight(artifact.html)); setResults(null); setBusy(false);
    listPublished().then(setPublished);
  }, [artifact?.id]);
  if (!target || !artifact || !artifact.html) return null;
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');
  const canPublish = errors.length === 0 && !busy && !result?.url;
  const doPublish = async () => { setBusy(true); const r = await publishHtml(artifact.title, artifact.html ?? ''); setResults(r); setBusy(false); if (r.url) { toast('Published — link copied', 'success'); navigator.clipboard?.writeText(r.url).catch(() => {}); listPublished().then(setPublished); } else if (r.error) toast('Publish failed: ' + r.error, 'error'); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast('Copied', 'success'); } catch { toast('Clipboard unavailable', 'warning'); } };
  const askFix = () => { insertIntoComposer(`Before I publish "${artifact.title}", fix these preflight findings:\n${issues.map((i) => `- [${i.level}] ${i.label}: ${i.fix ?? ''}`).join('\n')}\n\nThen present the corrected page again.`); closePublish(); };
  return (
    <div className="overlay publish-overlay" role="dialog" aria-label="Publish" onMouseDown={(e) => { if (e.target === e.currentTarget) closePublish(); }}>
      <div className="publish" ref={trap}>
        <div className="publish-head"><span className="pub-mark">⇪</span><div><b>Publish · {artifact.title}</b><div className="set-sub">Static hosting from your Mesa server · preflight runs before anything goes live</div></div><span className="spacer" /><button className="icon-btn" onClick={closePublish} title="Close (Esc)"><X size={16} /></button></div>
        <div className="publish-body">
          <div className="pub-section-title"><ShieldCheck size={13} /> Preflight</div>
          {issues.length === 0 && <div className="pub-ok"><Check size={13} /> No secrets, source maps or untrusted scripts found.</div>}
          {errors.map((i, k) => <div key={'e' + k} className="pub-issue error"><OctagonAlert size={13} /><div><b>{i.label}</b>{i.fix && <div className="set-sub">{i.fix}</div>}</div></div>)}
          {warnings.map((i, k) => <div key={'w' + k} className="pub-issue warn"><AlertTriangle size={13} /><div><b>{i.label}</b>{i.fix && <div className="set-sub">{i.fix}</div>}</div></div>)}
          {issues.length > 0 && <button className="chip-btn" onClick={askFix}><Sparkles size={11} />Ask the agent to fix</button>}
          {result?.url && (
            <div className="pub-result">
              <div className="pub-section-title"><Link2 size={13} /> Live link</div>
              <div className="pub-link"><input readOnly value={result.url} onFocus={(e) => e.target.select()} aria-label="Published URL" /><button className="chip-btn" onClick={() => copy(result.url!)}><Copy size={11} />Copy</button><a className="chip-btn" href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={11} />Open</a></div>
            </div>
          )}
          {result?.error && <div className="pub-issue error"><OctagonAlert size={13} /><div><b>Publish failed</b><div className="set-sub">{result.error} — publishing is served by scripts/serve.mjs</div></div></div>}
          {published.length > 0 && (
            <>
              <div className="pub-section-title">Published from this server</div>
              {published.map((p) => <div key={p.id} className="pub-link row"><span className="pub-id">{p.id}</span><a className="chip-btn" href={p.url} target="_blank" rel="noreferrer"><ExternalLink size={11} />Open</a><button className="chip-btn danger" onClick={async () => { await unpublish(p.id); setPublished(await listPublished()); toast('Link removed', 'info'); }}><Trash2 size={11} /></button></div>)}
            </>
          )}
        </div>
        <div className="publish-foot">
          <span className="set-sub">{errors.length ? `${errors.length} blocking issue${errors.length === 1 ? '' : 's'}` : warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'Ready to publish'}</span>
          <span className="spacer" />
          <button className="btn ghost" onClick={() => copy(artifact.html!)}>Copy HTML</button>
          <button className="btn primary" disabled={!canPublish} onClick={doPublish}>{busy ? 'Publishing…' : 'Publish'}</button>
        </div>
      </div>
    </div>
  );
}
