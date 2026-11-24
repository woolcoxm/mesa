// Client-side preflight for publishing an HTML artifact (mirrors the server's checks so the UI can explain them).
export interface PreflightIssue { level: 'error' | 'warn'; label: string; fix?: string }

const SECRET_PATTERNS: [string, RegExp][] = [
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Hard-coded secret in a script', /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i],
  ['Stripe key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
];

export function preflight(html: string): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  for (const [label, re] of SECRET_PATTERNS) if (re.test(scripts) || re.test(html)) issues.push({ level: 'error', label, fix: `Remove the ${label.toLowerCase()} and read it from an environment variable or a secret handle instead.` });
  if (/sourceMappingURL=/.test(html)) issues.push({ level: 'warn', label: 'Source map reference', fix: 'Rebuild without source maps before publishing.' });
  if (/\.env\b/.test(html)) issues.push({ level: 'warn', label: 'Mentions a .env file', fix: 'Make sure no .env contents are embedded in the page.' });
  const allowed = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'esm.sh', 'cdn.skypack.dev'];
  for (const m of html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)/gi)) { let host = ''; try { host = new URL(m[1]).hostname; } catch { /* ignore */ } if (!allowed.includes(host)) issues.push({ level: 'warn', label: `External script: ${m[1]}`, fix: 'Inline the dependency or pin it to a trusted CDN.' }); }
  if (/localhost:\d+/.test(html)) issues.push({ level: 'warn', label: 'Links to localhost', fix: 'Visitors cannot reach your localhost; use relative paths.' });
  return issues;
}

export async function publishHtml(title: string, html: string): Promise<{ url?: string; issues?: PreflightIssue[]; error?: string }> {
  try {
    const r = await fetch('/__mesa/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, html }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 422) return { issues: j.issues ?? [] };
    if (!r.ok) return { error: j.error ?? `${r.status}` };
    return { url: location.origin + j.url, issues: j.issues ?? [] };
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}

export async function listPublished(): Promise<{ id: string; url: string }[]> {
  try { const r = await fetch('/__mesa/published', { cache: 'no-store' }); if (!r.ok) return []; return (await r.json()).map((p: { id: string; url: string }) => ({ ...p, url: location.origin + p.url })); } catch { return []; }
}

export async function unpublish(id: string): Promise<void> {
  try { await fetch(`/__mesa/publish/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* ignore */ }
}
