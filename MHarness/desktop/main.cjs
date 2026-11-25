// Mesa desktop shell — an Electron window around scripts/serve.mjs (real shell, notebook execution, ACP bridge) and the built app.
//   electron .            → open Mesa in its own window
//   electron . --smoke    → load, report the document title and exit (used by the desktop smoke test)
const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const http = require('node:http');

const smoke = process.argv.includes('--smoke');
const appDir = join(__dirname, '..', 'app');
const distIndex = join(appDir, 'dist', 'index.html');
if (!existsSync(distIndex)) { console.error('mesa-desktop: build the app first — run `pnpm build` in MHarness/app'); if (smoke) process.exit(2); app.quit(); }

const port = Number(process.env.MESA_DESKTOP_PORT || 5173);
// In Electron, process.execPath is electron.exe: run the server as plain Node via ELECTRON_RUN_AS_NODE (same V8, no window).
const server = spawn(process.execPath, [join(appDir, 'scripts', 'serve.mjs')], { cwd: appDir, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
server.stdout.on('data', () => {}); server.stderr.on('data', (d) => process.stderr.write(`[mesa] ${d}`));
const shutdown = () => { if (server.exitCode === null) server.kill(); };
app.on('will-quit', shutdown); process.on('exit', shutdown);

function waitFor(url, ms) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => http.get(url, (r) => { r.resume(); resolve(); }).on('error', () => { if (Date.now() - started > ms) reject(new Error('server did not start')); else setTimeout(tick, 200); });
    tick();
  });
}

async function createWindow() {
  await waitFor(`http://127.0.0.1:${port}/__mesa/config`, 15000);
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 720, minHeight: 520, title: 'Mesa', backgroundColor: '#0f1115', show: !smoke, autoHideMenuBar: true });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Mesa', submenu: [{ role: 'quit' }] }, { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'togglefullscreen' }] }, { label: 'Help', submenu: [{ label: 'Mesa on GitHub', click: () => shell.openExternal('https://github.com/woolcoxm/mesa') }] }]));
  // Everything the app opens in a new tab/window goes to the system browser; the app itself stays in this window.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  if (smoke) {
    const title = await win.webContents.executeJavaScript('document.title');
    const ok = /Mesa/.test(title);
    console.log(`${ok ? '✓' : '✗'} desktop window loads Mesa — ${title}`);
    app.exit(ok ? 0 : 1);
  }
}

app.whenReady().then(createWindow).catch((e) => { console.error('mesa-desktop:', e.message); if (smoke) app.exit(1); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
