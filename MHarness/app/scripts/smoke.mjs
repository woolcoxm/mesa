// Cross-platform smoke test: boots scripts/serve.mjs with the real shell enabled, checks the app, the shell status and a real command.
// Usage: node scripts/smoke.mjs   (exits non-zero on failure; used by CI on Windows, macOS and Linux)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = 5199;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(here, 'serve.mjs')], { env: { ...process.env, PORT: String(port), MESA_SHELL: '1', MESA_ACP_MOCK: '1', MESA_NOTEBOOK: process.env.MESA_NOTEBOOK ?? '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 160) }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 120) : ''}`); };

async function waitForServer(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url + '/'); if (r.ok) return true; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function run(command, cwd = '.') {
  const r = await fetch(url + '/__mesa/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command, cwd, timeoutMs: 20000 }) });
  const text = await r.text();
  const events = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)));
  return { status: r.status, lines: events.filter((e) => e.type === 'line').map((e) => e.line), exit: events.find((e) => e.type === 'exit')?.code };
}

try {
  check('server starts', await waitForServer(), log.slice(-200));
  const shell = await (await fetch(url + '/__mesa/shell')).json();
  check('real shell enabled by MESA_SHELL=1', shell.enabled === true, JSON.stringify(shell));
  const r1 = await run('node -e "console.log(1+1)"');
  check('quoted command runs and prints 2', r1.exit === 0 && r1.lines.includes('2'), JSON.stringify(r1));
  const r2 = await run('node -e "process.exit(3)"');
  check('non-zero exit code propagates', r2.exit === 3, JSON.stringify(r2));
  const r3 = await run('node -e "console.log(require(\'os\').platform())"', '..');
  check('cwd outside the repo is refused (403)', r3.status === 403, r3.status);
  // POSIX staples agents reach for (head/tail/wc) work on every host OS — Windows rewrites them to PowerShell.
  const r4 = await run('head -n 1 README.md');
  check('head -n works on this OS', r4.exit === 0 && /# Mesa/.test(r4.lines.join('\n')), JSON.stringify(r4));
  const r5 = await run('wc -l README.md');
  check('wc -l works on this OS', r5.exit === 0 && /^\d+/.test(r5.lines.join('').trim()), JSON.stringify(r5));
  const cfg = await fetch(url + '/__mesa/config');
  check('config endpoint answers', cfg.ok);
  const mock = await fetch(url + '/__mesa/mock/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'mesa-mock', messages: [{ role: 'user', content: 'echo:hi' }] }) });
  check('offline mock streams', mock.ok && (await mock.text()).includes('hi'));
  // Notebook execution (MESA_NOTEBOOK=1): two cells in one process share state; a failing cell stops the run.
  const nb = await (await fetch(url + '/__mesa/notebook/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cells: ['x = 20', 'print(x + 1)', 'print(1 / 0)', 'print("never")'] }) })).json();
  check('notebook: cells share state in one process', nb.cells?.[1]?.output?.trim() === '21' && nb.exitCode === 1, JSON.stringify(nb));
  check('notebook: failing cell reports its own traceback and halts', nb.cells?.[2]?.failed === true && /ZeroDivisionError/.test(nb.cells[2].output) && !nb.cells[3].output, JSON.stringify(nb.cells?.[2]).slice(0, 120));
  // ACP bridge (MESA_ACP_MOCK=1): attach, stream a prompt, expect a done event.
  const attach = await (await fetch(url + '/__mesa/acp/attach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId: 'smoke' }) })).json();
  check('acp: agent attaches (initialize + session/new)', !!attach.agentSessionId, JSON.stringify(attach));
  const events = await new Promise(async (resolve) => {
    const ctrl = new AbortController(); const out = [];
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url + '/__mesa/acp/events?session=smoke', { signal: ctrl.signal });
      await fetch(url + '/__mesa/acp/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId: 'smoke', text: 'smoke: hello' }) });
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2); if (line.startsWith('data: ')) { const ev = JSON.parse(line.slice(6)); out.push(ev); if (ev.type === 'done' || ev.type === 'error') { ctrl.abort(); } } } }
    } catch { /* aborted after done */ }
    clearTimeout(timer); resolve(out);
  });
  const types = events.map((e) => e.type);
  const text = events.filter((e) => e.type === 'chunk').map((e) => e.text).join('');
  check('acp: prompt streams thought + chunks + done', types.includes('thought') && types.includes('chunk') && types.includes('done') && text.includes('ACP bridge online'), types.join(',') + ' | ' + text.slice(0, 80));
} catch (e) {
  check('smoke run threw', false, e.message);
} finally {
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
