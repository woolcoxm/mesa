// Cross-platform smoke test: boots scripts/serve.mjs with the real shell enabled, checks the app, the shell status and a real command.
// Usage: node scripts/smoke.mjs   (exits non-zero on failure; used by CI on Windows, macOS and Linux)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = 5199;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(here, 'serve.mjs')], { env: { ...process.env, PORT: String(port), MESA_SHELL: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const cfg = await fetch(url + '/__mesa/config');
  check('config endpoint answers', cfg.ok);
  const mock = await fetch(url + '/__mesa/mock/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'mesa-mock', messages: [{ role: 'user', content: 'echo:hi' }] }) });
  check('offline mock streams', mock.ok && (await mock.text()).includes('hi'));
} catch (e) {
  check('smoke run threw', false, e.message);
} finally {
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
