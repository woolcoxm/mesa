// Regenerates every README screenshot in docs/screenshots/ from a deterministic demo run.
// Usage: node scripts/shots.mjs   (boots scripts/serve.mjs on a scratch port, drives headless Chromium, exits non-zero on failure)
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const port = 5198;
const url = `http://127.0.0.1:${port}`;
const out = join(here, '..', '..', '..', 'docs', 'screenshots');
await mkdir(out, { recursive: true });

const server = spawn(process.execPath, [join(here, 'serve.mjs')], { env: { ...process.env, PORT: String(port), MESA_SHELL: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
const t0 = Date.now();
while (Date.now() - t0 < 15000) { try { const r = await fetch(url + '/'); if (r.ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 200)); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { if (!String(e).includes('SecurityError')) errors.push(String(e).slice(0, 200)); });
page.on('dialog', (d) => d.dismiss());
const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: join(out, name + '.png') }); console.log('✓', name); };
const step = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`${name}: ${String(e.message).split('\n')[0].slice(0, 160)}`); console.error('✗', name, String(e.message).split('\n')[0]); } };
const settings = async () => { await page.locator('.rail-bottom .nav-row').click(); await page.waitForTimeout(250); };
const back = async () => { await page.locator('.session-row.active').click(); await page.waitForTimeout(300); };
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(200); };

await page.goto(url + '/');
// Reset both stores (browser copy and the workspace state file) so the replay starts from the seeded demo.
await page.evaluate(() => localStorage.clear());
await page.evaluate(async () => { await fetch('/__mesa/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessions: [], settings: {} }) }); });
await page.reload(); await page.waitForTimeout(1500);

// 18 — guided tour (first run), stopped on the composer step
await step('tour', async () => { await page.locator('.tour-card .btn.primary').click(); await page.waitForTimeout(700); await shot('18-tour'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); });

// demo agent for deterministic screenshots (the settings shot shows the provider presets, so switch to Live briefly)
await settings();
await page.locator('.set-section:has-text("Agent") .seg button:has-text("Live model")').click(); await page.waitForTimeout(200);
await page.locator('.pf-presets button:has-text("Z.AI Coding Plan")').click();
await page.locator('.pf-field input').nth(2).fill('');
await page.locator('.page').evaluate((el) => { const s = el.querySelector('.set-section:nth-of-type(4)'); if (s) el.scrollTop = s.offsetTop - 60; });
await shot('10-settings');
await page.locator('.set-section:has-text("Agent") .seg button:has-text("Demo script")').click(); await page.waitForTimeout(300);
await back();

// 01 — empty session (shell)
await page.locator('.new-btn').click(); await page.waitForTimeout(300);
await shot('01-shell-dark');

// 02/03/04 — approval → showcase → preview
await page.locator('.suggest button').first().click();
await page.waitForSelector('.takeover', { timeout: 25000 });
await shot('02-approval');
await page.getByText('Allow once').click();
await page.waitForSelector('.showcase', { timeout: 40000 });
await page.waitForTimeout(1300);
await shot('03-showcase');
await page.locator('.showcase-verify .chip-btn:has-text("preview")').click(); await page.waitForTimeout(800);
await esc();
await shot('04-preview');

// 05 — run console with a typed command
await page.keyboard.press('Control+2'); await page.waitForTimeout(500);
await page.locator('.run-tab', { hasText: 'pnpm dev' }).click(); await page.waitForTimeout(500);
await page.locator('.xterm-host').click(); await page.keyboard.type('git status'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
await shot('05-run-console');

// 06 — files & diffs in split view
await page.keyboard.press('Control+4'); await page.waitForTimeout(500);
if (!(await page.locator('.dv-cols').count())) { await page.locator('.icon-btn[title="Split view"]').click(); await page.waitForTimeout(300); }
await page.locator('.file-row').first().click(); await page.waitForTimeout(300);
await shot('06-files-diffs');

// 07/08 — agents board, timeline (rename session)
await page.locator('.session-row', { hasText: 'Rename Series' }).first().click(); await page.keyboard.press('Control+5'); await page.waitForTimeout(500);
await page.locator('.seg button:has-text("Board")').click();
await shot('07-agents-board');
await page.locator('.seg button:has-text("Tree")').click();
await page.keyboard.press('Control+7'); await page.waitForTimeout(500);
await shot('08-timeline');

// 09 — gallery
await page.keyboard.press('Control+Shift+g'); await page.waitForTimeout(500);
await shot('09-gallery');
await esc();

// 11 — palette
await page.locator('.thread').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
await shot('11-palette');
await esc();

// 12/13/14 — light theme preview, narrow layout, light shell
await page.locator('.session-row', { hasText: 'Analyse revenue' }).first().click(); await page.keyboard.press('Control+3'); await page.waitForTimeout(600);
await page.keyboard.press('Control+k'); await page.locator('.palette-input input').fill('light theme'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
await shot('12-light-preview');
await page.setViewportSize({ width: 900, height: 760 }); await page.waitForTimeout(500);
await shot('13-narrow-900');
await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400);
await page.locator('.session-row', { hasText: 'Build a dashboard app' }).first().click(); await page.waitForTimeout(500);
await shot('14-light-shell');
await page.keyboard.press('Control+k'); await page.locator('.palette-input input').fill('dark theme'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);

// 15/16 — live mock with tool calling + real shell
await settings();
await page.locator('.set-section:has-text("Agent") .seg button:has-text("Live model")').click(); await page.waitForTimeout(200);
await page.locator('.pf-presets button:has-text("Mesa mock")').click(); await page.waitForTimeout(200);
const tools = page.locator('.tk-remember:has-text("tool calling") input'); if (!(await tools.isChecked())) await tools.check();
const shellSw = page.locator('.set-row:has-text("Real shell for live agents") .switch'); if (!((await shellSw.getAttribute('class')) ?? '').includes('on')) await shellSw.click();
await page.waitForTimeout(600);
await back();
await page.locator('.new-btn').click(); await page.waitForTimeout(200);
await page.locator('.composer-input').fill('List the workspace, then present the counter page'); await page.keyboard.press('Enter');
await page.waitForSelector('.takeover', { timeout: 30000 });
await shot('15-real-shell-approval');
await page.getByText('Allow once').click();
await page.waitForSelector('.showcase', { timeout: 40000 }); await esc();
await page.locator('.toolrow .icon-btn[title="Toggle output"]').first().click(); await page.waitForTimeout(200);
await page.locator('.toolrow .chip-btn:has-text("console")').first().click(); await page.waitForTimeout(700);
await shot('16-real-shell-console');

// 17 — accent colour
await settings();
await page.locator('.swatch[title="Rose"]').click(); await page.waitForTimeout(300);
await back();
await shot('17-accent-rose');
await settings(); await page.locator('.swatch[title="Indigo"]').click(); await page.waitForTimeout(300);

// 19 — canvas beside chat (wider viewport so the rail stays open)
await page.setViewportSize({ width: 1920, height: 1000 }); await page.waitForTimeout(400);
await page.locator('.session-row', { hasText: 'Analyse revenue' }).first().click(); await page.keyboard.press('Control+1'); await page.waitForTimeout(500);
await page.locator('.acard .chip-btn:has-text("Beside")').first().click(); await page.waitForTimeout(900);
await shot('19-canvas-beside');
await page.locator('.canvas-head .icon-btn[title^="Close"]').click(); await page.waitForTimeout(400);
// 22 — notebook beside chat (the revenue session's notebook deliverable)
await page.locator('.acard').filter({ has: page.locator('.acard-title', { hasText: /ipynb$/ }) }).locator('.chip-btn:has-text("Beside")').click(); await page.waitForTimeout(900);
await shot('22-notebook-beside');
await page.locator('.canvas-head .icon-btn[title^="Close"]').click();
await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400);

// 20 — shortcut editor
await settings();
await page.locator('.set-section:has-text("Keyboard")').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await shot('20-shortcut-editor');

// 21 — publish dialog with a clean preflight
await back();
await page.locator('.session-row', { hasText: 'Build a dashboard app' }).first().click(); await page.keyboard.press('Control+1'); await page.waitForTimeout(500);
await page.locator('.acard').filter({ has: page.locator('.acard-title', { hasText: /^Pulse dashboard$/ }) }).locator('.chip-btn[title="Share / publish"]').click(); await page.waitForTimeout(700);
await shot('21-publish');
await esc();

// leave the workspace in demo mode for whoever opens it next
await settings(); await page.locator('.set-section:has-text("Agent") .seg button:has-text("Demo script")').click(); await page.waitForTimeout(600);

await browser.close();
server.kill();
if (errors.length) { console.error('\nErrors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nAll screenshots regenerated in docs/screenshots/');
