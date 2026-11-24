// Minimal OpenAI-compatible chat adapter (streaming SSE + tool calling). No dependencies.
export interface ProviderConfig { baseUrl: string; apiKey: string; model: string; preset: string; proxy: boolean; temperature?: number }
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCallSpec[]; tool_call_id?: string }
export interface ToolCallSpec { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface ToolDef { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }

export interface StreamHandle { done: Promise<StreamResult>; abort: () => void }
export interface StreamResult { text: string; reasoning: string; toolCalls: ToolCallSpec[] }

export interface ProviderPreset { id: string; name: string; baseUrl: string; model: string; hint: string }

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'zai', name: 'Z.AI Coding Plan', baseUrl: 'https://api.z.ai/api/coding/paas/v4', model: 'glm-4.6', hint: 'GLM-4.6 / GLM-4.5-Air via your coding-plan key.' },
  { id: 'strata', name: 'Strata (local)', baseUrl: 'http://10.0.0.169:8080/v1', model: '', hint: 'Your locally hosted Strata router on 10.0.0.169:8080. It requires the API key you configured on Strata; models are fetched from /models.' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'Any OpenAI-compatible endpoint.' },
  { id: 'custom', name: 'Custom', baseUrl: '', model: '', hint: 'Any OpenAI-compatible base URL.' },
  { id: 'mock', name: 'Mesa mock (offline)', baseUrl: '/__mesa/mock', model: 'mesa-mock', hint: 'Scripted model served by scripts/serve.mjs. Exercises the full tool loop (bash → approval → present_html) with no key or network.' },
];

export const TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'present_html', description: 'Present a complete, self-contained HTML page or app as a deliverable artifact (inline CSS/JS, no external files). Use this instead of pasting HTML in the answer when the user wants a page, dashboard, chart or app.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'Short human title' }, html: { type: 'string', description: 'Full HTML document' } }, required: ['title', 'html'] } } },
  { type: 'function', function: { name: 'bash', description: 'Run a shell command in the workspace (demo sandbox). Returns stdout/stderr and exit code.', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string', description: 'defaults to mesa-demo' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read a text file from the demo workspace.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
];

/** URL builder: direct, or through the Mesa dev proxy (avoids CORS for endpoints that don't send CORS headers). */
export function urlFor(base: string, proxy: boolean, path: string): string {
  const b = base.replace(/\/+$/, '');
  if (b.startsWith('/')) return b + path; // same-origin (e.g. the offline mock)
  const full = b + path;
  if (!proxy) return full;
  if (typeof location !== 'undefined' && full.startsWith(location.origin)) return full;
  return `/proxy?u=${encodeURIComponent(full)}`;
}

export function streamChat(cfg: ProviderConfig, messages: ChatMessage[], onDelta: (text: string, full: string) => void, opts: { onReasoning?: (text: string, full: string) => void; tools?: ToolDef[]; useTools?: boolean; firstByteMs?: number } = {}): StreamHandle {
  const controller = new AbortController();
  const url = urlFor(cfg.baseUrl, cfg.proxy, '/chat/completions');
  let gotFirst = false;
  // Some endpoints hang silently (e.g. Strata with tool definitions): abort if nothing arrives.
  const watchdog = setTimeout(() => { if (!gotFirst) controller.abort(); }, opts.firstByteMs ?? 120_000);
  const done: Promise<StreamResult> = (async () => {
    try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature: cfg.temperature ?? 0.6, ...(opts.useTools && opts.tools ? { tools: opts.tools, tool_choice: 'auto', parallel_tool_calls: false } : {}) }),
    });
    if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = ''; let full = ''; let reasoning = '';
    const calls: Record<number, { id: string; name: string; args: string }> = {};
    for (;;) {
      const { value, done: fin } = await reader.read();
      gotFirst = true; clearTimeout(watchdog);
      if (fin) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const choice = json.choices?.[0];
          const r = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning ?? '';
          if (r && opts.onReasoning) { reasoning += r; opts.onReasoning(r, reasoning); }
          const delta = choice?.delta?.content ?? (choice?.message?.content && !choice?.delta ? choice.message.content : '') ?? '';
          if (delta) { full += delta; onDelta(delta, full); }
          const tcs = choice?.delta?.tool_calls;
          if (Array.isArray(tcs)) for (const tc of tcs) { const i = tc.index ?? 0; calls[i] = calls[i] ?? { id: tc.id ?? `call_${i}_${Date.now()}`, name: '', args: '' }; if (tc.id) calls[i].id = tc.id; if (tc.function?.name) calls[i].name += tc.function.name; if (tc.function?.arguments) calls[i].args += tc.function.arguments; }
        } catch { /* partial */ }
      }
    }
    const toolCalls: ToolCallSpec[] = Object.keys(calls).sort((a, b) => Number(a) - Number(b)).map((k) => ({ id: calls[Number(k)].id, type: 'function', function: { name: calls[Number(k)].name, arguments: calls[Number(k)].args || '{}' } }));
    return { text: full, reasoning, toolCalls };
    } catch (e) {
      if (!gotFirst && controller.signal.aborted) throw new Error(`No response from ${cfg.model} within ${Math.round((opts.firstByteMs ?? 120_000) / 1000)}s — the endpoint may not accept this request (try disabling tool calling)`);
      throw e;
    } finally { clearTimeout(watchdog); }
  })();
  return { done, abort: () => controller.abort() };
}

/** GET /models on the endpoint → sorted ids. */
export async function listModels(cfg: ProviderConfig): Promise<string[]> {
  const res = await fetch(urlFor(cfg.baseUrl, cfg.proxy, '/models'), { headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {} });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const list: unknown[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return list.map((m) => (typeof m === 'string' ? m : (m as { id?: string; name?: string })?.id ?? (m as { name?: string })?.name ?? '')).filter(Boolean).sort();
}

/** Server-side real shell (scripts/serve.mjs, opt-in). Streams lines; resolves with the exit code. */
export async function runShellStream(args: { command: string; cwd: string; timeoutMs?: number; onLine: (stream: 'stdout' | 'stderr', line: string) => void; signal?: AbortSignal }): Promise<{ exitCode: number }> {
  const res = await fetch('/__mesa/run', { method: 'POST', signal: args.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: args.command, cwd: args.cwd, timeoutMs: args.timeoutMs }) });
  if (!res.ok || !res.body) { let msg = `${res.status}`; try { msg = (await res.json())?.error ?? msg; } catch { /* ignore */ } throw new Error(msg); }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = ''; let exitCode = -1;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split('\n\n'); buf = events.pop() ?? '';
    for (const ev of events) {
      const line = ev.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try { const j = JSON.parse(line.slice(5).trim()); if (j.type === 'line') args.onLine(j.stream, j.line); else if (j.type === 'exit') exitCode = j.code; } catch { /* partial */ }
    }
  }
  return { exitCode };
}

export async function shellStatus(): Promise<{ enabled: boolean; root?: string }> {
  try { const r = await fetch('/__mesa/shell', { cache: 'no-store' }); return r.ok ? await r.json() : { enabled: false }; } catch { return { enabled: false }; }
}

export const SYSTEM_PROMPT_TOOLS = `You are Mesa, an agent working inside a visual harness. Be concise and concrete.
You have tools. When the user wants a page, app, dashboard, chart or any visual thing, call present_html with the complete, self-contained HTML (inline CSS and JS, no external files) and keep your prose short. Use bash to run commands when it helps (ask only via the tool; the user approves in the UI). Use read_file to look at workspace files before editing them.
After presenting an artifact, say in one or two sentences what you built and how to verify it. Never claim you created something without calling present_html.`;

export const SYSTEM_PROMPT_FENCE = `You are Mesa, an agent working inside a visual harness. Be concise and concrete.
When the user wants a page, app, dashboard, chart or any visual thing, output the complete, self-contained HTML in a single fenced code block tagged \`\`\`html (inline CSS and JS, no external files, include a <title>). Mesa renders that block live as an artifact with a preview. Keep prose to one or two sentences before the block and never claim a result without including the block.
For code files use fenced blocks tagged with the language.`;

export const SYSTEM_PROMPT = SYSTEM_PROMPT_TOOLS;

/** Extract ```html fenced blocks from a markdown answer (fallback when the model ignores the tool). */
export function extractHtmlArtifacts(text: string): { title: string; html: string }[] {
  const out: { title: string; html: string }[] = [];
  const re = /```html\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    const html = m[1].trim();
    const title = /<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? /<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] ?? `App ${i + 1}`;
    out.push({ title: title.trim(), html });
    i++;
  }
  return out;
}

export async function testProvider(cfg: ProviderConfig): Promise<string> {
  const h = streamChat({ ...cfg, temperature: 0 }, [{ role: 'user', content: 'Reply with the single word: ok' }], () => {});
  const r = await h.done;
  return (r.text.trim() || (r.toolCalls.length ? `wants to call ${r.toolCalls[0].function.name}` : '')).slice(0, 40) || 'connected';
}
