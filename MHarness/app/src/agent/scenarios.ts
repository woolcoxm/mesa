import type { Artifact, DiffInfo, AgentNode, Plan } from '../state/types';

export type ArtifactSeed = Omit<Artifact, 'id' | 'sessionId' | 'turnId' | 'createdAt'>;

export type SceneStep =
  | { t: 'think'; text: string }
  | { t: 'text'; text: string; speed?: number }
  | { t: 'tool'; name: string; title: string; subtitle?: string; ms: number; output?: string; diff?: DiffInfo; runtime?: 'host' | 'sandbox' | 'kernel' | 'static'; approval?: { kind: 'shell' | 'write' | 'network' | 'install' | 'publish'; title: string; detail: string; flags: string[]; risk?: { level: 'low' | 'medium' | 'high'; rationale: string } }; artifact?: ArtifactSeed; stream?: boolean; runId?: string; error?: string }
  | { t: 'run'; id: string; command: string; runtime: 'host' | 'sandbox' | 'kernel' | 'static'; cwd: string; lines: string[]; ms: number; background?: boolean; port?: number; exitCode?: number; artifact?: ArtifactSeed; owner?: 'user' | 'agent'; approval?: { kind: 'shell' | 'install'; title: string; detail: string; flags: string[]; risk?: { level: 'low' | 'medium' | 'high'; rationale: string } } }
  | { t: 'present'; artifacts: ArtifactSeed[] }
  | { t: 'plan'; items: string[] }
  | { t: 'goal'; text: string; total: number }
  | { t: 'agents'; agents: Pick<AgentNode, 'name' | 'role'>[] }
  | { t: 'agentDone'; name: string; note?: string }
  | { t: 'checkpoint'; label: string; auto?: boolean }
  | { t: 'wait'; ms: number };

export interface Scenario { id: string; match: RegExp[]; title: string; steps: SceneStep[] }

const diff = (file: string, oldLines: string[], newLines: string[]): DiffInfo => ({
  file,
  added: newLines.filter((l) => !oldLines.includes(l)).length,
  removed: oldLines.filter((l) => !newLines.includes(l)).length,
  hunks: [{ oldStart: 10, oldLines, newStart: 10, newLines }],
});

export const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui;background:#0f1115;color:#e8ebef;min-height:100vh;display:grid;place-items:center}
.card{width:420px;padding:28px;border-radius:20px;background:linear-gradient(145deg,#161a21,#11141a);border:1px solid #232933;box-shadow:0 30px 80px rgba(0,0,0,.5)}
h1{margin:0 0 4px;font-size:20px;letter-spacing:-.01em}.sub{color:#9aa4b2;font-size:13px;margin-bottom:22px}
.bars{display:flex;gap:8px;align-items:flex-end;height:140px;margin-bottom:22px}.bar{flex:1;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#7c86ff,#4f5bd9);animation:grow 1.2s cubic-bezier(.2,.9,.25,1) both;transform-origin:bottom}
@keyframes grow{from{transform:scaleY(.05);opacity:.3}to{transform:scaleY(1);opacity:1}}
.row{display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-top:1px solid #1c212a}.row span:last-child{font-family:ui-monospace;color:#37c981}
.pill{display:inline-flex;gap:6px;align-items:center;font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(124,134,255,.16);color:#a5adff;margin-bottom:14px}
.pulse{width:6px;height:6px;border-radius:50%;background:#7c86ff;box-shadow:0 0 0 0 #7c86ff;animation:pulse 1.6s infinite}@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(124,134,255,0)}100%{box-shadow:0 0 0 0 rgba(124,134,255,0)}}
</style></head><body><div class="card"><div class="pill"><i class="pulse"></i>Live · built by Mesa</div><h1>Pulse dashboard</h1><div class="sub">Weekly active agents · sandbox demo</div>
<div class="bars">${[42, 60, 48, 78, 64, 90, 100].map((h) => `<div class="bar" style="height:${h}%;animation-delay:${h * 4}ms"></div>`).join('')}</div>
<div class="row"><span>Runs today</span><span>1,284</span></div><div class="row"><span>Success rate</span><span>98.2%</span></div><div class="row"><span>Median run</span><span>1.4s</span></div></div></body></html>`;

export const CHART_HTML = (spec: { title: string; labels: string[]; values: number[] }) => {
  const max = Math.max(...spec.values);
  const bars = spec.values.map((v, i) => `<div class="b" title="${spec.labels[i]}: ${v}"><div class="v" style="height:${(v / max) * 100}%"></div><span>${spec.labels[i]}</span></div>`).join('');
  return `<html><head><style>body{margin:0;font-family:Inter,system-ui;color:var(--mesa-text-primary,#15181d);background:transparent}.wrap{padding:16px}h3{margin:0 0 12px;font-size:14px}.grid{display:flex;gap:10px;align-items:flex-end;height:180px;border-bottom:1px solid var(--mesa-border-subtle,#e3e6eb);padding-bottom:4px}.b{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:6px}.v{width:70%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--mesa-accent,#4f5bd9),var(--mesa-info,#2a8bd6));animation:grow .9s cubic-bezier(.2,.9,.25,1) both;transform-origin:bottom}.b span{font-size:11px;color:var(--mesa-text-muted,#8a93a1)}@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}</style></head><body><div class="wrap"><h3>${spec.title}</h3><div class="grid">${bars}</div></div></body></html>`;
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'app',
    title: 'Build a dashboard app',
    match: [/app|dashboard|build|prototype|preview|vite|react/i],
    steps: [
      { t: 'think', text: 'The user wants a small, flashy dashboard. I will scaffold a Vite app, write the dashboard component, install dependencies, start the dev server and present the result.' },
      { t: 'plan', items: ['Scaffold Vite + React project', 'Write dashboard component', 'Install dependencies', 'Start dev server & verify preview', 'Present deliverables'] },
      { t: 'tool', name: 'read', title: 'read package.json', subtitle: 'mesa-demo/', ms: 120, output: '{ "name": "mesa-demo", "private": true, "scripts": { "dev": "vite" } }' },
      { t: 'tool', name: 'edit', title: 'edit src/App.tsx', subtitle: 'mesa-demo/src/App.tsx', ms: 340, artifact: { kind: 'code', title: 'src/App.tsx', path: 'mesa-demo/src/App.tsx', lines: 48, added: 48, removed: 0, verification: { tests: 'unknown', preview: 'none', diff: true }, code: `export default function App() {\n  const data = useWeekly();\n  return (\n    <Card>\n      <Pill live />\n      <h1>Pulse dashboard</h1>\n      <Bars values={data} />\n      <Stats runs={1284} success={0.982} />\n    </Card>\n  );\n}` }, diff: diff('src/App.tsx', ['export default function App() {', '  return <div>Hello</div>;', '}'], ['export default function App() {', '  const data = useWeekly();', '  return (', '    <Card>', '      <Pill live />', '      <h1>Pulse dashboard</h1>', '      <Bars values={data} />', '      <Stats runs={1284} success={0.982} />', '    </Card>', '  );', '}']) },
      { t: 'tool', name: 'edit', title: 'edit src/styles.css', subtitle: 'mesa-demo/src/styles.css', ms: 280, artifact: { kind: 'code', title: 'src/styles.css', path: 'mesa-demo/src/styles.css', lines: 36, added: 36, removed: 0, verification: { tests: 'unknown', preview: 'none', diff: true }, code: '.card {\n  width: 420px;\n  padding: 28px;\n  border-radius: 20px;\n  background: linear-gradient(145deg, #161a21, #11141a);\n}\n.bar {\n  animation: grow 1.2s cubic-bezier(.2, .9, .25, 1) both;\n}' }, diff: diff('src/styles.css', ['.card { padding: 12px; }'], ['.card {', '  width: 420px;', '  padding: 28px;', '  border-radius: 20px;', '  background: linear-gradient(145deg, #161a21, #11141a);', '}', '.bar {', '  animation: grow 1.2s cubic-bezier(.2, .9, .25, 1) both;', '}']) },
      {
        t: 'run', id: 'install', command: 'pnpm install', runtime: 'host', cwd: 'mesa-demo', ms: 1600, background: false,
        lines: ['Lockfile is up to date, resolution step is skipped', 'Packages: +142', '++++++++++++++++++++++++++++++++++++++', 'Progress: resolved 142, reused 138, downloaded 4, added 142, done', 'Done in 1.4s'],
        approval: { kind: 'install', title: 'Install dependencies', detail: 'pnpm install  (runs 3 install scripts: esbuild, @swc/core, sharp)', flags: ['install scripts'], risk: { level: 'low', rationale: 'Lockfile matches; packages are from the workspace allow-list.' } },
      },
      { t: 'tool', name: 'bash', title: 'start dev server', subtitle: 'pnpm dev', ms: 400, stream: true },
      { t: 'run', id: 'dev', command: 'pnpm dev', runtime: 'host', cwd: 'mesa-demo', ms: 1500, background: true, port: 5173, lines: ['> mesa-demo@0.1.0 dev', '> vite', '', 'VITE v7.3.8  ready in 412 ms', '', '➜  Local:   http://localhost:5173/', '➜  Network: use --host to expose', '', '10:31:04 [vite] hmr update /src/App.tsx'] },
      { t: 'text', text: 'Dev server is up on **:5173**. Opening it in the Preview pane and checking for console errors…', speed: 2 },
      { t: 'tool', name: 'preview', title: 'open preview', subtitle: 'http://localhost:5173', ms: 900, output: 'console: 0 errors · 2 logs · 1 HMR update' },
      { t: 'checkpoint', label: 'Before present' },
      { t: 'present', artifacts: [
        { kind: 'app', title: 'Pulse dashboard', path: 'mesa-demo/', framework: 'Vite', html: APP_HTML, bytes: 4021, verification: { tests: 'unknown', preview: 'ready', diff: true }, tags: ['app', 'demo'] },
        { kind: 'code', title: 'src/App.tsx', path: 'mesa-demo/src/App.tsx', lines: 48, added: 48, removed: 0, code: `export default function App() {\n  const data = useWeekly();\n  return (\n    <Card>\n      <Pill live />\n      <h1>Pulse dashboard</h1>\n      <Bars values={data} />\n      <Stats runs={1284} success={0.982} />\n    </Card>\n  );\n}`, verification: { tests: 'unknown', preview: 'ready', diff: true } },
        { kind: 'code', title: 'src/styles.css', path: 'mesa-demo/src/styles.css', lines: 36, added: 36, removed: 0, code: '.card {\n  width: 420px;\n  padding: 28px;\n  border-radius: 20px;\n  background: linear-gradient(145deg, #161a21, #11141a);\n}\n.bar {\n  animation: grow 1.2s cubic-bezier(.2, .9, .25, 1) both;\n}', verification: { tests: 'unknown', preview: 'ready', diff: true } },
      ] },
      { t: 'text', text: 'Done. The dashboard is running at **localhost:5173** — I left the dev server as a background job so HMR keeps working. **Verify** with the preview or the diff before you share it.', speed: 2 },
    ],
  },
  {
    id: 'chart',
    title: 'Analyse revenue data',
    match: [/chart|analy|revenue|data|csv|report|plot|graph/i],
    steps: [
      { t: 'think', text: 'I need to load the CSV, aggregate by month, produce a chart canvas and a short markdown report.' },
      { t: 'plan', items: ['Load revenue.csv', 'Aggregate by month', 'Render chart canvas', 'Write summary report', 'Present'] },
      { t: 'tool', name: 'read', title: 'read data/revenue.csv', subtitle: '1,204 rows', ms: 140, output: 'month,region,revenue\n2026-01,NA,182400\n2026-01,EMEA,120330\n… (1,204 rows)' },
      {
        t: 'run', id: 'analysis', command: 'python analysis/aggregate.py', runtime: 'kernel', cwd: 'mesa-demo', ms: 1400, exitCode: 0,
        lines: ['Loaded 1204 rows', 'Grouped by month → 7 buckets', 'Wrote build/revenue.json', 'ok 0.8s'],
        artifact: { kind: 'table', title: 'revenue.json', path: 'build/revenue.json', lines: 7, code: '[\n  { "month": "Jan", "revenue": 182400 },\n  { "month": "Feb", "revenue": 201110 },\n  { "month": "Mar", "revenue": 198000 },\n  { "month": "Apr", "revenue": 244300 },\n  { "month": "May", "revenue": 261900 },\n  { "month": "Jun", "revenue": 298500 },\n  { "month": "Jul", "revenue": 331200 }\n]' },
      },
      { t: 'tool', name: 'python', title: 'render chart', subtitle: 'matplotlib → build/revenue.png', ms: 700 },
      { t: 'text', text: 'Revenue grew **+81 %** from January to July. June→July is the steepest step (+11 %) — mostly EMEA. Here is the chart and the summary.', speed: 2 },
      { t: 'present', artifacts: [
        { kind: 'chart', title: 'Revenue by month', path: 'canvas:revenue', chart: { title: 'Revenue by month (USD)', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'], values: [182400, 201110, 198000, 244300, 261900, 298500, 331200] }, inputs: { source: 'data/revenue.csv', groupBy: 'month' }, verification: { tests: 'unknown', preview: 'ready', diff: false }, tags: ['data'] },
        { kind: 'markdown', title: 'summary.md', path: 'reports/summary.md', lines: 14, code: '# Revenue summary\n\nRevenue rose **+81 %** Jan→Jul 2026.\n\n| Month | Revenue |\n|---|---|\n| Jan | 182,400 |\n| Jul | 331,200 |\n\nStepest step: Jun→Jul (+11 %), driven by EMEA.\n', verification: { tests: 'unknown', preview: 'none', diff: false } },
        { kind: 'table', title: 'revenue.json', path: 'build/revenue.json', lines: 7, code: '[\n  { "month": "Jan", "revenue": 182400 },\n  { "month": "Feb", "revenue": 201110 },\n  { "month": "Mar", "revenue": 198000 },\n  { "month": "Apr", "revenue": 244300 },\n  { "month": "May", "revenue": 261900 },\n  { "month": "Jun", "revenue": 298500 },\n  { "month": "Jul", "revenue": 331200 }\n]', verification: { tests: 'unknown', preview: 'none', diff: false } },
        {
          kind: 'notebook', title: 'revenue_analysis.ipynb', path: 'mesa-demo/revenue_analysis.ipynb', lines: 48, verification: { tests: 'unknown', preview: 'ready', diff: false }, tags: ['data', 'notebook'],
          notebook: { kernel: 'Python 3.12 · mesa-bundled', language: 'python', cells: [
            { kind: 'markdown', source: '# Revenue analysis\n\nLoad `data/revenue.csv`, aggregate by month and plot the trend.' },
            { kind: 'code', source: 'data = [  # month, revenue (USD) from data/revenue.csv\n    ("2026-01", 182400), ("2026-02", 201110), ("2026-03", 198000),\n    ("2026-04", 244300), ("2026-05", 261900), ("2026-06", 298500),\n    ("2026-07", 331200),\n]\nprint(f"{len(data)} months, {sum(r for _, r in data):,} USD total")\nfor row in data[:3]:\n    print(row)', execution_count: 1, outputs: [{ type: 'text', value: "7 months, 1,717,410 USD total\n('2026-01', 182400)\n('2026-02', 201110)\n('2026-03', 198000)" }] },
            { kind: 'code', source: 'months = [m for m, _ in data]\nrevenue = dict(data)\nprint(f"{\'month\':<9}{\'revenue\':>10}{\'growth\':>9}")\nprev = None\nfor m in months:\n    growth = f"{(revenue[m] / prev - 1):+.1%}" if prev else "      —"\n    print(f"{m:<9}{revenue[m]:>10,}{growth:>9}")\n    prev = revenue[m]', execution_count: 2, outputs: [{ type: 'text', value: "month       revenue   growth\n2026-01     182,400        —\n2026-02     201,110   +10.3%\n2026-03     198,000    -1.5%\n2026-04     244,300   +23.4%\n2026-05     261,900    +7.2%\n2026-06     298,500   +14.0%\n2026-07     331,200   +11.0%" }] },
            { kind: 'code', source: 'peak = max(months, key=revenue.get)\nprint("Revenue by month (USD, ▇ = 10k)\\n")\nfor m in months:\n    bar = "▇" * (revenue[m] // 10_000)\n    print(f"{m} {bar:<34} {revenue[m]:>9,}")\nprint(f"\\nPeak: {peak} with {revenue[peak]:,} USD — {(revenue[peak] / revenue[months[0]] - 1):+.0%} vs {months[0]}.")', execution_count: 3, outputs: [{ type: 'text', value: "Revenue by month (USD, ▇ = 10k)\n\n2026-01 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                   182,400\n2026-02 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                 201,110\n2026-03 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                  198,000\n2026-04 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇             244,300\n2026-05 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇           261,900\n2026-06 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇        298,500\n2026-07 ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇    331,200\n\nPeak: 2026-07 with 331,200 USD — +82% vs 2026-01." }] },
          ] },
        },
      ] },
    ],
  },
  {
    id: 'test',
    title: 'Fix failing tests',
    match: [/test|fix|fail|bug|pytest|vitest|broken/i],
    steps: [
      { t: 'think', text: 'Run the suite first to get the real failures, then fix the smallest thing that makes them pass.' },
      {
        t: 'run', id: 'tests-1', command: 'pnpm test', runtime: 'host', cwd: 'mesa-demo', ms: 1700, exitCode: 1,
        lines: ['> vitest run', '', ' ❯ src/lib/stats.test.ts (3 tests | 1 failed)', '   × computes success rate', '     → expected 0.982 received 0.98', '   ✓ sums runs', '   ✓ formats latency', '', ' Test Files  1 failed (1)', '      Tests  1 failed | 2 passed (3)', '   Start at  10:32:11', '   Duration  1.61s'],
        artifact: { kind: 'test-report', title: 'vitest run', path: 'run:tests-1', verification: { tests: 'fail', preview: 'none', diff: false }, code: 'FAIL src/lib/stats.test.ts > computes success rate\nexpected 0.982 received 0.98' },
      },
      { t: 'text', text: 'One failure: `success rate` rounds to 2 decimals but the test expects 3. The bug is in `src/lib/stats.ts` — `toFixed(2)` should be `toFixed(3)`. Fixing it.', speed: 2 },
      { t: 'tool', name: 'edit', title: 'edit src/lib/stats.ts', subtitle: 'mesa-demo/src/lib/stats.ts', ms: 260, artifact: { kind: 'code', title: 'src/lib/stats.ts', path: 'mesa-demo/src/lib/stats.ts', lines: 21, added: 1, removed: 1, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'export function successRate(ok: number, total: number) {\n  return Number((ok / total).toFixed(3));\n}' }, diff: diff('src/lib/stats.ts', ['  return Number((ok / total).toFixed(2));'], ['  return Number((ok / total).toFixed(3));']) },
      {
        t: 'run', id: 'tests-2', command: 'pnpm test', runtime: 'host', cwd: 'mesa-demo', ms: 1500, exitCode: 0,
        lines: ['> vitest run', '', ' ✓ src/lib/stats.test.ts (3 tests)', '   ✓ computes success rate', '   ✓ sums runs', '   ✓ formats latency', '', ' Test Files  1 passed (1)', '      Tests  3 passed (3)', '   Duration  1.42s'],
        artifact: { kind: 'test-report', title: 'vitest run', path: 'run:tests-2', verification: { tests: 'pass', preview: 'none', diff: false }, code: 'PASS src/lib/stats.test.ts (3 tests) — 1.42s' },
      },
      { t: 'present', artifacts: [
        { kind: 'code', title: 'src/lib/stats.ts', path: 'mesa-demo/src/lib/stats.ts', lines: 21, added: 1, removed: 1, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'export function successRate(ok: number, total: number) {\n  return Number((ok / total).toFixed(3));\n}' },
        { kind: 'test-report', title: 'vitest run · 3 passed', path: 'run:tests-2', verification: { tests: 'pass', preview: 'none', diff: false }, code: 'PASS src/lib/stats.test.ts (3 tests) — 1.42s' },
      ] },
      { t: 'text', text: 'Fixed and verified — **3/3 tests pass**. One line changed; the diff is in the showcase.', speed: 2 },
    ],
  },
  {
    id: 'refactor',
    title: 'Refactor with subagents',
    match: [/refactor|rename|migrate|across|extract|clean/i],
    steps: [
      { t: 'think', text: 'This touches several modules. I will fan out two subagents to audit callers while I change the core, then merge findings.' },
      { t: 'plan', items: ['Rename Series → TimeSeries in core', 'Audit callers in src/app (agent-2)', 'Audit callers in tests (agent-3)', 'Apply caller edits', 'Present diff set'] },
      { t: 'agents', agents: [{ name: 'agent-2', role: 'Audit src/app callers' }, { name: 'agent-3', role: 'Audit tests' }] },
      { t: 'tool', name: 'grep', title: 'grep "Series"', subtitle: 'src/', ms: 180, output: 'src/core/series.ts:12: export interface Series {\nsrc/app/chart.ts:4: import type { Series }\nsrc/app/chart.ts:40: (s: Series) => …\ntests/chart.test.ts:9: Series' },
      { t: 'tool', name: 'edit', title: 'edit src/core/series.ts', subtitle: 'rename Series → TimeSeries', ms: 300, artifact: { kind: 'code', title: 'src/core/series.ts', path: 'mesa-demo/src/core/series.ts', lines: 64, added: 3, removed: 3, verification: { tests: 'unknown', preview: 'none', diff: true }, code: 'export interface TimeSeries {\n  points: Point[];\n  unit?: string;\n}\n\nexport function isEmpty(s: TimeSeries) {\n  return s.points.length === 0;\n}' }, diff: diff('src/core/series.ts', ['export interface Series {', '}', 'export function isEmpty(s: Series) {'], ['export interface TimeSeries {', '}', 'export function isEmpty(s: TimeSeries) {']) },
      { t: 'wait', ms: 900 },
      { t: 'agentDone', name: 'agent-2', note: '2 call sites in src/app/chart.ts' },
      { t: 'wait', ms: 700 },
      { t: 'agentDone', name: 'agent-3', note: '1 call site in tests/chart.test.ts' },
      { t: 'tool', name: 'edit', title: 'edit src/app/chart.ts', subtitle: '2 call sites', ms: 260, artifact: { kind: 'code', title: 'src/app/chart.ts', path: 'mesa-demo/src/app/chart.ts', lines: 120, added: 2, removed: 2, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'import type { TimeSeries } from "../core/series";\n\nexport function draw(s: TimeSeries) {', } , diff: diff('src/app/chart.ts', ['import type { Series } from "../core/series"', '(s: Series) => …'], ['import type { TimeSeries } from "../core/series"', '(s: TimeSeries) => …']) },
      { t: 'tool', name: 'edit', title: 'edit tests/chart.test.ts', subtitle: '1 call site', ms: 200, artifact: { kind: 'code', title: 'tests/chart.test.ts', path: 'mesa-demo/tests/chart.test.ts', lines: 44, added: 1, removed: 1, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'const s: TimeSeries = { points: [] };', }, diff: diff('tests/chart.test.ts', ['const s: Series = { points: [] };'], ['const s: TimeSeries = { points: [] };']) },
      { t: 'present', artifacts: [
        { kind: 'code', title: 'src/core/series.ts', path: 'mesa-demo/src/core/series.ts', lines: 64, added: 3, removed: 3, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'export interface TimeSeries {\n  points: Point[];\n  unit?: string;\n}\n\nexport function isEmpty(s: TimeSeries) {\n  return s.points.length === 0;\n}' },
        { kind: 'code', title: 'src/app/chart.ts', path: 'mesa-demo/src/app/chart.ts', lines: 120, added: 2, removed: 2, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'import type { TimeSeries } from "../core/series";\n\nexport function draw(s: TimeSeries) {' },
        { kind: 'code', title: 'tests/chart.test.ts', path: 'mesa-demo/tests/chart.test.ts', lines: 44, added: 1, removed: 1, verification: { tests: 'pass', preview: 'none', diff: true }, code: 'const s: TimeSeries = { points: [] };' },
      ] },
      { t: 'text', text: 'Rename complete across **3 files** (+6 −6). Both audit agents reported no remaining `Series` references. Suggest running the suite before merging.', speed: 2 },
    ],
  },
  {
    id: 'goal',
    title: 'Long-running goal',
    match: [/goal|ship|release|keep going|until|overnight/i],
    steps: [
      { t: 'goal', text: 'Ship v0.3: docs, tests green, changelog', total: 5 },
      { t: 'plan', items: ['Update docs', 'Green tests', 'Changelog', 'Version bump', 'Tag'] },
      { t: 'think', text: 'This is multi-round work. I will record a goal so progress survives across turns and start with round 1.' },
      { t: 'tool', name: 'edit', title: 'edit docs/guide.md', subtitle: 'mesa-demo/docs/guide.md', ms: 300, artifact: { kind: 'markdown', title: 'docs/guide.md', path: 'mesa-demo/docs/guide.md', lines: 96, added: 40, removed: 4, verification: { tests: 'unknown', preview: 'none', diff: true }, code: '# Guide\n\n## Getting started\n…' } },
      { t: 'checkpoint', label: 'Round 1 complete' },
      { t: 'present', artifacts: [{ kind: 'markdown', title: 'docs/guide.md', path: 'mesa-demo/docs/guide.md', lines: 96, added: 40, removed: 4, verification: { tests: 'unknown', preview: 'none', diff: true }, code: '# Guide\n\n## Getting started\n\n1. Install\n2. Run `mesa`\n…' }] },
      { t: 'text', text: 'Round 1 done — docs updated. Goal progress **1/5**; I will continue automatically in the next round.', speed: 2 },
    ],
  },
];

export const DEFAULT_SCENARIO: Scenario = {
  id: 'default',
  title: 'Quick answer',
  match: [],
  steps: [
    { t: 'think', text: 'A direct question — answer concisely, with one quick reference check.' },
    { t: 'tool', name: 'read', title: 'read README.md', subtitle: 'mesa-demo/', ms: 120, output: '# mesa-demo\nVite + React sandbox used by Mesa demos.' },
    { t: 'text', text: "Here's the short version: Mesa is the window where the agent works on the right and you steer on the left. Try asking me to **build an app**, **analyse revenue**, **fix the tests**, or **refactor Series** to see the full loop — tool calls, approvals, runs and the completion showcase.", speed: 2 },
  ],
};

export function pickScenario(text: string): Scenario {
  for (const s of SCENARIOS) if (s.match.some((r) => r.test(text))) return s;
  return DEFAULT_SCENARIO;
}

export const SEED_PLAN: Plan = { items: [{ text: 'Scaffold Vite + React project', state: 'done' }, { text: 'Write dashboard component', state: 'done' }, { text: 'Install dependencies', state: 'done' }, { text: 'Start dev server & verify preview', state: 'done' }, { text: 'Present deliverables', state: 'done' }], reviewed: true };