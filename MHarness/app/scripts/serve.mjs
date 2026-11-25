// Zero-dependency static server for the built app + a tiny dev proxy for model endpoints + an optional real shell for live agents.
import http from 'node:http';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const appRoot = join(root, '..');
// The real shell may only run inside the repository root (the nearest ancestor with a .git folder), else the app folder.
import { existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
let workspaceRoot = appRoot;
for (let d = appRoot; d !== dirname(d); d = dirname(d)) { if (existsSync(join(d, '.git'))) { workspaceRoot = d; break; } }
const port = Number(process.env.PORT || 5173);
// Only http(s) targets on the allow-list are proxied. Extend with PROXY_ALLOW="host1,host2" (comma-separated hostnames).
const allow = new Set(['api.z.ai', 'api.openai.com', '10.0.0.169', ...(process.env.PROXY_ALLOW ?? '').split(',').map((s) => s.trim()).filter(Boolean)]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

// Optional bootstrap config: mesa.config.json → { provider: {...}, agent: 'live' | 'demo', shell: boolean }.
let bootConfig = {};
try { bootConfig = JSON.parse(await readFile(join(root, '..', 'mesa.config.json'), 'utf8')); } catch { /* none */ }
// Test/CI knobs: MESA_NOTEBOOK=1 enables notebook execution with `python` on PATH; MESA_ACP_MOCK=1 registers the reference ACP agent.
if (process.env.MESA_NOTEBOOK && !bootConfig.notebook) bootConfig.notebook = { command: process.env.MESA_NOTEBOOK === '1' ? 'python' : process.env.MESA_NOTEBOOK };
if (process.env.MESA_ACP_MOCK === '1' && !bootConfig.acp) bootConfig.acp = { command: process.execPath, args: [fileURLToPath(import.meta.url).replace(/serve\.mjs$/, 'mock-acp-agent.mjs')] };
// Real shell for live agents is opt-in: "shell": true in mesa.config.json or MESA_SHELL=1. Always gated by the in-app approval takeover.
const shellEnabled = bootConfig.shell === true || process.env.MESA_SHELL === '1';

// A failing handler must never take the whole dev server down (a stuck tab is worse than a 500).
process.on('uncaughtException', (e) => { console.error('mesa: uncaught in a request handler —', e instanceof Error ? e.message : e); });
process.on('unhandledRejection', (e) => { console.error('mesa: unhandled rejection —', e instanceof Error ? e.message : e); });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname === '/proxy') return proxy(req, res, url);
  if (url.pathname === '/__mesa/allow') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify([...allow])); }
  if (url.pathname === '/__mesa/shell') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ enabled: shellEnabled, root: workspaceRoot })); }
  if (url.pathname === '/__mesa/run') return runShell(req, res);
  if (url.pathname === '/__mesa/publish' && req.method === 'POST') return publish(req, res);
  if (url.pathname === '/__mesa/published') return listPublished(res);
  if (url.pathname === '/__mesa/state' && req.method === 'GET') return getStateFile(res);
  if (url.pathname === '/__mesa/state' && req.method === 'PUT') return putStateFile(req, res);
  // ACP bridge (Agent Client Protocol over stdio) — the agent command comes from mesa.config.json only; the page can never spawn arbitrary processes.
  if (url.pathname === '/__mesa/acp/status') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ configured: !!bootConfig.acp?.command, command: bootConfig.acp ? [bootConfig.acp.command, ...(bootConfig.acp.args ?? [])].join(' ') : null })); }
  if (url.pathname === '/__mesa/acp/attach' && req.method === 'POST') return acpAttach(req, res);
  if (url.pathname === '/__mesa/acp/prompt' && req.method === 'POST') return acpPrompt(req, res);
  if (url.pathname === '/__mesa/acp/cancel' && req.method === 'POST') return acpCancel(req, res);
  if (url.pathname === '/__mesa/acp/permission' && req.method === 'POST') return acpPermission(req, res);
  if (url.pathname === '/__mesa/acp/events') return acpEvents(req, res, url);
  // Notebook execution — the interpreter comes from mesa.config.json ("notebook": { "command": "python" }); code runs from a temp file inside the repository.
  if (url.pathname === '/__mesa/notebook/status') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ configured: !!bootConfig.notebook?.command, command: bootConfig.notebook?.command ?? null })); }
  if (url.pathname === '/__mesa/notebook/run' && req.method === 'POST') return notebookRun(req, res);
  if (url.pathname.startsWith('/__mesa/publish/') && req.method === 'DELETE') return unpublish(url, res);
  if (url.pathname === '/__mesa/config') {
    // Local-only bootstrap config (mesa.config.json next to package.json). Served only to this origin.
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(bootConfig));
  }
  if (url.pathname === '/__mesa/mock/models') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ object: 'list', data: [{ id: 'mesa-mock', object: 'model' }] })); }
  if (url.pathname === '/__mesa/mock/chat/completions') return mockChat(req, res);
  try {
    const path = decodeURIComponent(url.pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
    try { if ((await readFile(file)).length >= 0 && extname(file) === '') throw 0; } catch { file = join(root, 'index.html'); }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

// ---------- optional real shell for live agents (SSE) ----------
async function runShell(req, res) {
  if (!shellEnabled) {
    res.writeHead(403, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'shell disabled on this server', hint: 'set "shell": true in mesa.config.json or MESA_SHELL=1' }));
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { res.writeHead(400); return res.end('bad json'); }
  const command = String(body.command ?? '').trim();
  if (!command || command.length > 4000) { res.writeHead(400); return res.end('bad command'); }
  let sendNote = '';
  const caseFold = (s) => (process.platform === 'win32' || process.platform === 'darwin' ? s.toLowerCase() : s);
  const requested = resolve(workspaceRoot, String(body.cwd ?? '.'));
  if (caseFold(requested) !== caseFold(workspaceRoot) && !caseFold(requested).startsWith(caseFold(workspaceRoot + sep))) { res.writeHead(403); return res.end('cwd outside workspace'); }
  let cwd = requested;
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    sendNote = `mesa: cwd "${body.cwd}" not found — using ${workspaceRoot}`;
    cwd = workspaceRoot;
  }
  const timeoutMs = Math.min(300_000, Math.max(1_000, Number(body.timeoutMs) || 60_000));
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const send = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
  const isWin = process.platform === 'win32';
  // Small POSIX→cmd alias table so agent-issued `ls`/`cat` behave on Windows.
  const aliases = { ls: 'dir /b', 'ls -la': 'dir', cat: 'type', pwd: 'cd', clear: 'cls', which: 'where', rm: 'del', mv: 'move', cp: 'copy', touch: 'type nul >', 'rm -rf': 'rmdir /s /q', 'mkdir -p': 'mkdir' };
  let cmdLine = command;
  if (isWin) {
    // Argument-taking POSIX staples that a plain prefix swap cannot express.
    let m;
    if ((m = /^head\s+(?:-n\s+)?(\d+)\s+(.+)$/.exec(command))) cmdLine = `powershell -NoProfile -Command "Get-Content -TotalCount ${m[1]} '${m[2]}'"`;
    else if ((m = /^head\s+([^-].*)$/.exec(command))) cmdLine = `powershell -NoProfile -Command "Get-Content -TotalCount 10 '${m[1]}'"`;
    else if ((m = /^tail\s+(?:-n\s+)?(\d+)\s+(.+)$/.exec(command))) cmdLine = `powershell -NoProfile -Command "Get-Content -Tail ${m[1]} '${m[2]}'"`;
    else if ((m = /^wc\s+-l\s+(.+)$/.exec(command))) cmdLine = `powershell -NoProfile -Command "(Get-Content '${m[1]}').Count"`;
    else {
      const first = command.split(/\s+/).slice(0, 2).join(' ');
      const one = command.split(/\s+/)[0];
      const hit = aliases[first] && aliases[first] !== aliases[one] ? [first, aliases[first]] : aliases[one] ? [one, aliases[one]] : null;
      if (hit) cmdLine = aliases[hit[0]] + command.slice(hit[0].length);
    }
  }
  // /s strips the outer quotes so inner quotes survive: cmd /d /s /c "node -e "console.log(1)""
  // POSIX: the user's login shell ($SHELL — bash, zsh, fish…) with -c, so PATH tools like node/pnpm resolve as expected.
  const userShell = process.env.SHELL || '/bin/sh';
  const child = isWin
    ? spawn('cmd.exe', ['/d', '/s', '/c', `"${cmdLine}"`], { cwd, env: { ...process.env, FORCE_COLOR: '0', CI: '1', NO_COLOR: '1' }, windowsHide: true, windowsVerbatimArguments: true })
    : spawn(userShell, ['-c', cmdLine], { cwd, env: { ...process.env, FORCE_COLOR: '0', CI: '1', NO_COLOR: '1' } });
  send({ type: 'started', pid: child.pid, cwd, command });
  if (sendNote) send({ type: 'line', stream: 'stderr', line: sendNote });
  const pump = (stream, name) => {
    let buf = '';
    stream.setEncoding('utf8');
    stream.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); for (const line of lines) send({ type: 'line', stream: name, line }); });
    stream.on('end', () => { if (buf) send({ type: 'line', stream: name, line: buf }); });
  };
  pump(child.stdout, 'stdout'); pump(child.stderr, 'stderr');
  const timer = setTimeout(() => { send({ type: 'line', stream: 'stderr', line: `mesa: killed after ${timeoutMs / 1000}s` }); child.kill(); }, timeoutMs);
  child.on('error', (e) => { clearTimeout(timer); send({ type: 'line', stream: 'stderr', line: `mesa: ${e.message}` }); send({ type: 'exit', code: -1 }); res.end(); });
  child.on('close', (code) => { clearTimeout(timer); send({ type: 'exit', code: code ?? -1 }); res.end(); });
  req.on('close', () => { if (child.exitCode === null) child.kill(); });
}

// ---------- publish: preflight + static hosting under dist/published ----------
const publishedDir = join(root, 'published');
const SECRET_PATTERNS = [
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Assigned secret/assignment in script', /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i],
  ['Stripe key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
];
function preflight(html) {
  const issues = [];
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  for (const [label, re] of SECRET_PATTERNS) if (re.test(scripts) || re.test(html)) issues.push({ level: 'error', label });
  if (/sourceMappingURL=/.test(html)) issues.push({ level: 'warn', label: 'Source map reference' });
  if (/\.env\b/.test(html)) issues.push({ level: 'warn', label: 'Mentions a .env file' });
  const external = [...html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]);
  const ALLOWED_CDN = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'esm.sh', 'cdn.skypack.dev'];
  for (const src of external) { let host = ''; try { host = new URL(src).hostname; } catch { /* ignore */ } if (!ALLOWED_CDN.includes(host)) issues.push({ level: 'warn', label: `External script: ${src}` }); }
  if (/localhost:\d+/.test(html)) issues.push({ level: 'warn', label: 'Links to localhost' });
  return issues;
}
async function publish(req, res) {
  const chunks = []; for await (const c of req) chunks.push(c);
  let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { res.writeHead(400); return res.end('bad json'); }
  const html = String(body.html ?? ''); const title = String(body.title ?? 'artifact').slice(0, 80);
  if (!html.trim() || html.length > 2_000_000) { res.writeHead(400); return res.end('empty or too large'); }
  const issues = preflight(html);
  if (issues.some((i) => i.level === 'error')) { res.writeHead(422, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ issues })); }
  await mkdir(publishedDir, { recursive: true });
  const id = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'artifact'}-${Date.now().toString(36)}`;
  await writeFile(join(publishedDir, `${id}.html`), html);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id, url: `/published/${id}.html`, issues }));
}
async function listPublished(res) {
  let files = []; try { files = (await readdir(publishedDir)).filter((f) => f.endsWith('.html')); } catch { /* none */ }
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(files.map((f) => ({ id: f.replace(/\.html$/, ''), url: `/published/${f}` })).sort().reverse()));
}
async function unpublish(url, res) {
  const id = url.pathname.split('/').pop();
  if (!/^[\w-]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
  await rm(join(publishedDir, `${id}.html`), { force: true });
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
}

// ---------- workspace state file (cross-browser persistence; git-ignored) ----------
const stateFile = join(appRoot, 'mesa.state.json');
async function getStateFile(res) {
  try { const body = await readFile(stateFile, 'utf8'); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"no state"}'); }
}
async function putStateFile(req, res) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length > 25_000_000) { res.writeHead(413); return res.end('too large'); }
  try { JSON.parse(text); } catch { res.writeHead(400); return res.end('bad json'); }
  await writeFile(stateFile, text);
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, bytes: text.length }));
}

// ---------- ACP bridge: Agent Client Protocol (JSON-RPC 2.0, newline-delimited) over the agent's stdio ----------
import readline from 'node:readline';
const agents = new Map(); // mesaSessionId → { proc, agentSessionId, nextId, pending, clients, initialised }
function acpJson(res, code, body) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
async function readJsonBody(req) { const chunks = []; for await (const c of req) chunks.push(c); try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; } }
function acpEmit(entry, event) { for (const res of entry.clients) { if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); } }
function acpSend(entry, method, params) {
  const id = entry.nextId++;
  return new Promise((resolve, reject) => {
    entry.pending.set(id, { resolve, reject });
    entry.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (entry.pending.has(id)) { entry.pending.delete(id); reject(new Error(`${method} timed out`)); } }, 30_000);
  });
}
async function acpStart(mesaSessionId) {
  const cfg = bootConfig.acp; if (!cfg?.command) throw new Error('ACP is not configured on this server (set "acp": { "command": "...", "args": [...] } in mesa.config.json)');
  let entry = agents.get(mesaSessionId);
  if (entry && entry.proc.exitCode === null && entry.initialised) return entry;
  entry = { proc: null, agentSessionId: null, nextId: 1, pending: new Map(), clients: new Set(), initialised: false, permissionOptions: new Map() };
  agents.set(mesaSessionId, entry);
  entry.proc = spawn(cfg.command, cfg.args ?? [], { cwd: workspaceRoot, env: { ...process.env, ...(cfg.env ?? {}) }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  entry.proc.stderr.on('data', (d) => acpEmit(entry, { type: 'stderr', text: String(d).slice(0, 500) }));
  entry.proc.on('exit', (code) => { acpEmit(entry, { type: 'status', status: 'exited', code }); for (const p of entry.pending.values()) p.reject(new Error('agent exited')); entry.pending.clear(); entry.initialised = false; });
  const rl = readline.createInterface({ input: entry.proc.stdout });
  rl.on('line', (line) => {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    // Response to one of our requests
    if (msg.id !== undefined && entry.pending.has(msg.id)) { const p = entry.pending.get(msg.id); entry.pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message ?? 'agent error')); else p.resolve(msg.result); return; }
    // Notification from the agent
    if (msg.method === 'session/update') {
      const u = msg.params?.update ?? {}; const text = u.content?.text ?? (Array.isArray(u.content) ? u.content.map((c) => c.content?.text ?? '').join('') : '');
      if (u.sessionUpdate === 'agent_message_chunk') acpEmit(entry, { type: 'chunk', text });
      else if (u.sessionUpdate === 'agent_thought_chunk') acpEmit(entry, { type: 'thought', text });
      else if (u.sessionUpdate === 'tool_call') acpEmit(entry, { type: 'tool', toolCallId: u.toolCallId, title: u.title, kind: u.kind, status: u.status ?? 'pending' });
      else if (u.sessionUpdate === 'tool_call_update') acpEmit(entry, { type: 'tool_update', toolCallId: u.toolCallId, status: u.status, text: Array.isArray(u.content) ? u.content.map((c) => c.content?.text ?? '').join('\n') : '' });
      else if (u.sessionUpdate === 'plan') acpEmit(entry, { type: 'plan', entries: u.entries ?? [] });
      return;
    }
    // Request from the agent: permission
    if (msg.method === 'session/request_permission') {
      const options = (msg.params?.options ?? []).map((o) => ({ optionId: o.optionId, name: o.name, kind: o.kind }));
      entry.permissionOptions.set(String(msg.id), options);
      acpEmit(entry, { type: 'permission', requestId: String(msg.id), toolCallId: msg.params?.toolCall?.toolCallId, title: msg.params?.toolCall?.title ?? 'Permission', command: msg.params?.toolCall?.rawInput?.command ?? '', options });
      return;
    }
    if (msg.id !== undefined) entry.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n'); // unsupported requests get an empty ok
  });
  await acpSend(entry, 'initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
  entry.initialised = true;
  const s = await acpSend(entry, 'session/new', { cwd: workspaceRoot, mcpServers: [] });
  entry.agentSessionId = s?.sessionId;
  acpEmit(entry, { type: 'status', status: 'attached' });
  return entry;
}
async function acpAttach(req, res) { const b = await readJsonBody(req); if (!b?.mesaSessionId) return acpJson(res, 400, { error: 'mesaSessionId required' }); try { const e = await acpStart(b.mesaSessionId); acpJson(res, 200, { ok: true, agentSessionId: e.agentSessionId }); } catch (e) { acpJson(res, 500, { error: e.message }); } }
async function acpPrompt(req, res) {
  const b = await readJsonBody(req); if (!b?.mesaSessionId || typeof b.text !== 'string') return acpJson(res, 400, { error: 'mesaSessionId and text required' });
  let entry; try { entry = await acpStart(b.mesaSessionId); } catch (e) { return acpJson(res, 500, { error: e.message }); }
  if (!entry.agentSessionId) return acpJson(res, 500, { error: 'agent has no session' });
  acpEmit(entry, { type: 'status', status: 'running' });
  acpSend(entry, 'session/prompt', { sessionId: entry.agentSessionId, prompt: [{ type: 'text', text: b.text }] })
    .then((r) => acpEmit(entry, { type: 'done', stopReason: r?.stopReason ?? 'end_turn' }))
    .catch((e) => acpEmit(entry, { type: 'error', message: e.message }));
  acpJson(res, 200, { ok: true });
}
async function acpCancel(req, res) { const b = await readJsonBody(req); const entry = agents.get(b?.mesaSessionId); if (entry?.agentSessionId && entry.proc.exitCode === null) { try { await acpSend(entry, 'session/cancel', { sessionId: entry.agentSessionId }); } catch { /* ignore */ } } acpJson(res, 200, { ok: true }); }
async function acpPermission(req, res) {
  const b = await readJsonBody(req); const entry = agents.get(b?.mesaSessionId);
  if (!entry || !b?.requestId) return acpJson(res, 404, { error: 'no such agent/request' });
  const options = entry.permissionOptions.get(String(b.requestId)) ?? [];
  const optionId = options.some((o) => o.optionId === b.optionId) ? b.optionId : (options.find((o) => /reject/.test(o.kind))?.optionId ?? options[0]?.optionId);
  entry.permissionOptions.delete(String(b.requestId));
  if (entry.proc.exitCode === null) entry.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: b.requestId, result: { outcome: { outcome: 'selected', optionId } } }) + '\n');
  acpJson(res, 200, { ok: true, optionId });
}
function acpEvents(req, res, url) {
  const id = url.searchParams.get('session'); const entry = agents.get(id);
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.write(`data: ${JSON.stringify({ type: 'hello', attached: !!entry?.initialised })}\n\n`);
  if (!entry) { res.end(); return; }
  entry.clients.add(res);
  req.on('close', () => entry.clients.delete(res));
}

// ---------- notebook execution ----------
// Cells run in ONE interpreter process with a per-cell wrapper: state carries over between cells, each cell's output is
// delimited by a marker, and a failing cell prints its traceback, stops the run and reports exit 1.
const CELL_MARK = (i, suffix = '') => `\u0000MESA_CELL_${i}${suffix}\u0000`;
function wrapPythonCells(cells) {
  return cells.map((src, i) => [`print(${JSON.stringify(CELL_MARK(i))}, end="")`, 'try:', `    exec(compile(${JSON.stringify(src)}, f"<cell ${i + 1}>", "exec"), g)`, 'except Exception:', '    traceback.print_exc()', `    print(${JSON.stringify(CELL_MARK(i, '_FAIL'))}, end="")`, '    sys.exit(1)', ''].join('\n')).join('\n');
}
async function notebookRun(req, res) {
  const cfg = bootConfig.notebook; if (!cfg?.command) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Notebook execution is not configured — add "notebook": { "command": "python" } to mesa.config.json and restart serve.mjs.' })); }
  const b = await readJsonBody(req);
  const cells = Array.isArray(b?.cells) ? b.cells.map((c) => String(c ?? '')) : [String(b?.code ?? '')];
  if (!cells.length || cells.some((c) => !c.trim()) || cells.join('\n').length > 200_000) { res.writeHead(400); return res.end(JSON.stringify({ error: 'empty or too large' })); }
  const started = Date.now();
  const dir = join(root, '.tmp'); await mkdir(dir, { recursive: true });
  const file = join(dir, `notebook-${process.pid}-${started}.py`);
  await writeFile(file, 'import sys, traceback\ng = {"__name__": "__main__"}\n' + wrapPythonCells(cells), 'utf8');
  const out = await new Promise((resolve) => {
    let stdout = '', stderr = '';
    const child = spawn(cfg.command, [...(cfg.args ?? []), file], { cwd: workspaceRoot, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const cap = (s) => (s.length > 64_000 ? s.slice(0, 64_000) + '\n… output truncated' : s);
    child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { child.kill(); stderr += `\nmesa: killed after ${cfg.timeoutMs ?? 30_000} ms`; }, cfg.timeoutMs ?? 30_000);
    child.on('exit', (exitCode) => { clearTimeout(timer); resolve({ exitCode: exitCode ?? -1, stdout: cap(stdout), stderr: cap(stderr) }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ exitCode: -1, stdout: cap(stdout), stderr: '', error: `${cfg.command}: ${e.message}` }); });
  });
  await rm(file, { force: true });
  // Walk the stream: each cell marker starts a new segment; a _FAIL marker flags that cell; text before the first marker is startup noise.
  const tokens = out.stdout.split(/(\u0000MESA_CELL_\d+(?:_FAIL)?\u0000)/);
  const results = cells.map(() => ({ output: '', failed: false }));
  let current = -1;
  for (const t of tokens) {
    const m = /^\u0000MESA_CELL_(\d+)(_FAIL)?\u0000$/.exec(t);
    if (m) { if (m[2]) { if (results[Number(m[1])]) results[Number(m[1])].failed = true; } else current = Number(m[1]); continue; }
    if (current >= 0 && results[current]) results[current].output += t;
  }
  for (const r of results) r.output = r.output.trimEnd();
  const exitCode = out.error ? -1 : (out.exitCode ?? -1);
  const firstFail = results.findIndex((r) => r.failed);
  if (out.stderr) { const k = firstFail >= 0 ? firstFail : 0; results[k].output = (results[k].output + '\n' + out.stderr.trim()).trim(); results[k].failed = firstFail >= 0 || exitCode !== 0; }
  if (out.error) results[0].failed = true;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ cells: results, exitCode, stderr: out.stderr.trim(), error: out.error, ms: Date.now() - started }));
}

async function proxy(req, res, url) {
  const target = url.searchParams.get('u');
  if (!target) { res.writeHead(400); return res.end('missing u'); }
  let t;
  try { t = new URL(target); } catch { res.writeHead(400); return res.end('bad u'); }
  if (t.protocol !== 'http:' && t.protocol !== 'https:') { res.writeHead(400); return res.end('bad scheme'); }
  if (!allow.has(t.hostname)) { res.writeHead(403); return res.end(`host not allowed: ${t.hostname} (add to PROXY_ALLOW)`); }
  const headers = {};
  for (const h of ['content-type', 'authorization', 'accept', 'anthropic-version', 'anthropic-beta']) if (req.headers[h]) headers[h] = req.headers[h];
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  try {
    const upstream = await fetch(t, { method: req.method, headers, body, duplex: body ? 'half' : undefined });
    const out = {};
    for (const h of ['content-type', 'cache-control']) if (upstream.headers.get(h)) out[h] = upstream.headers.get(h);
    res.writeHead(upstream.status, out);
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res); else res.end();
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`proxy error: ${e?.message ?? e}`);
  }
}

server.listen(port, '127.0.0.1', () => console.log(`mesa preview → http://127.0.0.1:${port}  (proxy allow-list: ${[...allow].join(', ')})`));

// ---------- offline mock model with tool calling (preset "Mesa mock") ----------
const MOCK_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Glowing Click Counter</title><style>
body{margin:0;height:100vh;display:grid;place-items:center;background:#0b0d11;color:#e8ebef;font-family:Inter,system-ui}
button{padding:18px 30px;font-size:18px;border:0;border-radius:14px;background:#222;color:#fff;cursor:pointer;animation:glow 1.4s ease-in-out infinite alternate}
@keyframes glow{from{box-shadow:0 0 10px #4f5bd9,0 0 30px #4f5bd9aa}to{box-shadow:0 0 24px #7c86ff,0 0 70px #7c86ffcc}}
p{margin-top:16px;color:#9aa4b2}</style></head><body><div style="text-align:center"><button id="b">Clicked 0 times</button><p>Built by the Mesa mock model · presented via present_html</p></div>
<script>let n=0;document.getElementById('b').onclick=()=>{n++;document.getElementById('b').textContent='Clicked '+n+' times'}</script></body></html>`;

async function mockChat(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1] ?? {};
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-control', 'connection': 'keep-alive' });
  const send = async (obj) => { res.write(`data: ${JSON.stringify({ id: 'mock', object: 'chat.completion.chunk', model: 'mesa-mock', choices: [{ index: 0, ...obj }] })}\n\n`); await new Promise((r) => setTimeout(r, 25)); };
  const text = async (s) => { for (const piece of s.match(/.{1,6}/gs) ?? []) await send({ delta: { content: piece } }); };
  const reason = async (s) => { for (const piece of s.match(/.{1,10}/gs) ?? []) await send({ delta: { reasoning_content: piece } }); };
  const call = async (id, name, args) => {
    await send({ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: '' } }] } });
    for (const piece of args.match(/.{1,40}/gs) ?? []) await send({ delta: { tool_calls: [{ index: 0, function: { arguments: piece } }] } });
    await send({ delta: {}, finish_reason: 'tool_calls' });
  };
  if (messages.some((m) => m.role === 'system' && /security reviewer/i.test(String(m.content)))) {
    // Auto-review hook: answer the one-line risk verdict the approval flow expects.
    const risky = /\b(sudo|rm -rf|curl .*\| ?sh|git push|drop table)\b/i.test(String(last.content));
    await send({ delta: { content: risky ? 'high — matches a destructive pattern' : 'low — read-only command inside the repository' } });
    await send({ delta: {}, finish_reason: 'stop' }); res.end(); return;
  }
  if (last.role === 'user' && typeof last.content === 'string' && last.content.startsWith('echo:')) {
    // Test hook: stream the rest of the prompt verbatim (markdown / HTML edge cases).
    const body = last.content.slice(5).replace(/^\s+/, '');
    for (const piece of body.match(/[\s\S]{1,24}/g) ?? []) { await send({ delta: { content: piece } }); await new Promise((r) => setTimeout(r, 4)); }
    await send({ delta: {}, finish_reason: 'stop' });
  } else if (last.role === 'user' && hasTools) {
    await reason('The user wants a page. I should look at the workspace first, then present the HTML.');
    await call('call_bash_1', 'bash', JSON.stringify({ command: 'ls', cwd: 'mesa-demo' }));
  } else if (last.role === 'tool' && hasTools && last.tool_call_id === 'call_bash_1') {
    await reason('The workspace has src/. Now I will present the page as an artifact.');
    await call('call_present_1', 'present_html', JSON.stringify({ title: 'Glowing Click Counter', html: MOCK_HTML }));
  } else if (last.role === 'user' && !hasTools) {
    // Fence mode (no native tools): ask for a shell command first, then present the page once the output comes back.
    if (/^Output of `/.test(String(last.content))) { await text('The workspace has `src/`. Here is a tiny self-contained HTML page with a glowing button that counts clicks.\n\n```html\n' + MOCK_HTML + '\n```\n'); }
    else { await text('Let me look at the workspace first.\n\n```bash\nls\n```\n'); }
    await send({ delta: {}, finish_reason: 'stop' });
  } else {
    await text('Done — I built **Glowing Click Counter** and presented it as an artifact. Open the preview and click the button to verify the count updates.');
    await send({ delta: {}, finish_reason: 'stop' });
  }
  res.write('data: [DONE]\n\n');
  res.end();
}
