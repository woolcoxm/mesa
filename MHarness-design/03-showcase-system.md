# Mesa — Showcase System

## 1. Completion Showcase window

**Trigger rules**
- A turn ends with ≥ 1 `present`-declared deliverable → show.
- A turn ends with ≥ 3 changed files but no `present` call → show a *Changed-files* showcase (degraded: list view, no hero thumbnails). Inspired by DSH's changed-files card.
- A background job finishes that produces an artifact (test report, build output) → show only if `Settings → Notifications → "Job finished with artifacts"` is on.
- **Never** show while an approval is pending, while the user is typing in the composer (caret active in last 2 s), or during Do-not-disturb.

**Window anatomy (520 × auto, max 70 vh)**
```
┌─ ✦ 3 deliverables · turn 14 · 1m 42s ─────────────── ⧉ Pin all  ✕ ─┐
│ ┌──────────────────────── hero card ────────────────────────────┐  │
│ │ [code]  src/app.ts                              +42 −7  2.1 kB │  │
│ │ ┌ thumbnail: syntax-highlighted first 12 lines ────────────┐   │  │
│ │ │ export function compute(input: Series) {                  │   │  │
│ │ └───────────────────────────────────────────────────────────┘   │  │
│ │ ✓ tests pass (12)   ⚠ 1 todo                                   │  │
│ │ [Open] [Compare] [Run] [Share] [Pin to Gallery]   ⋮            │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ┌──────────────────────── hero card ────────────────────────────┐  │
│ │ [chart] revenue.canvas                                 re-run ▸  │  │
│ │ ┌ thumbnail: rendered canvas ──────────────────────────────┐   │  │
│ └────────────────────────────────────────────────────────────┘   │  │
│ [Verify all: diff · preview · tests]      [Open in dock →]         │
└────────────────────────────────────────────────────────────────────┘
```

**Motion**
- Enter: translateX(100 % → 0) + opacity 0 → 1, 360 ms, `cubic-bezier(.2,.9,.25,1)`; cards stagger 60 ms each (`transition-delay: index * 60ms`).
- Exit (dismiss): opacity 1 → 0 + translateY(0 → 8 px), 160 ms ease-in.
- Minimise to tray: FLIP animation to the tray icon position, 280 ms.
- Reduced motion: all transitions become 0 ms opacity-only.
- Interruptible: any pointer-down inside the window cancels the enter transition at its current position.

**Stacking**: if a second showcase fires while one is open, the first minimises to the tray (FLIP) and the new one takes the slot. Max 3 in tray; oldest becomes a toast.

**Delivery ceremony** (optional flair): on showcases with ≥ 3 deliverables *and* all verifications green, a one-shot 900 ms "sweep" — a 1 px accent line travels left→right under the header, then the header glow pulses once. Purpose: mark the moment of *verified* completion. Off-switch: `Settings → Appearance → Completion effects` (default on). No confetti by default; a `confetti` skill plugin may add it.

## 2. Deliverable card content schema

```ts
interface DeliverableCard {
  id: string;                 // artifact id
  kind: ArtifactKind;         // badge
  title: string;              // file name or canvas title
  subtitle?: string;          // path, or "re-run with new inputs"
  stats?: { lines?: number; bytes?: number; added?: number; removed?: number; cells?: number };
  thumbnail?: { url: string; blurhash?: string; width: number; height: number };
  verification?: { tests?: 'pass'|'fail'|'unknown'; preview?: 'ready'|'error'|'none'; diff?: boolean };
  actions: Array<'open'|'compare'|'run'|'share'|'pin'|'rerun'|'explain'>;
  pinnedToGallery?: boolean;
  sessionId: string; turnId: string; createdAt: string;
}
```

## 3. Artifact renderer catalog

| Artifact type | Detection | Renderer | Interactivity | Run availability |
|---|---|---|---|---|
| Code file (`.ts/.js/.py/.go/.rs/.java…`) | extension → Monaco language | Monaco read-only | Hover symbols, "Explain selection", "Send selection to agent", `Ctrl+Enter` → Quick Run | ✅ host shell / sandbox |
| Diff / patch (`.diff`, tool edit) | `tool.edit` events | Monaco diff viewer | Split/unified, word-level, "Explain this hunk", "Revert hunk" (asks agent) | — |
| Notebook (`.ipynb`) | extension | NotebookView | Cell run, kernel status, outputs inline, "Convert to script" | ✅ kernel (Jupyter) |
| HTML / SVG | extension | Sandboxed iframe / inline SVG | Live, device sizes, "Open in browser" | ✅ static serve |
| React / Vite / Next app | `package.json` scripts + framework detector | PreviewTab (iframe) | HMR via dev-server websocket, console/network tabs, screenshot-to-chat, send-element-to-agent | ✅ one-click app runner |
| Image (`.png/.jpg/.webp/.gif/.svg`) | extension / MIME | `<img>` + lightbox | Zoom/pan, "Send region to agent" | — |
| Chart / data table (`.canvas`, `.parquet`, `.csv`, `.json` table) | `present` kind `chart`/`table` or extension | CanvasView (Vega-Lite / Plotly / custom) | Filter, hover tooltips, "Re-run with new inputs", export PNG/CSV | ✅ re-run canvas |
| Markdown / doc (`.md/.docx`) | extension | Rendered MD (shiki, math, mermaid) / docx renderer | Outline, copy, "Open in editor" | — |
| PDF / PPTX / XLSX | extension | PDF.js / slide renderer / sheet grid | Page nav, slide nav, cell inspect, "Edit via agent" | — |
| Test report | `present` kind `test-report` or junit XML | TestRunnerView tree | Click → failing line, "Ask agent to fix" | ✅ re-run tests |
| CLI output | `tool.bash` result | BashOutput (ansi) | Expand, search, "Open in console" | ✅ re-run command |
| Video / audio | extension/MIME | `<video>` / `<audio>` | Scrub, loop, "Transcribe" | — |
| 3D (`.glb/.gltf/.obj`) | extension | three.js viewer | Orbit, "Screenshot to agent" | — |
| Custom | plugin registers `artifactRenderer` for a kind | plugin component | plugin-defined | plugin-defined |

Third-party renderers register via `registerArtifactRenderer({ kind, component, actions })`.

## 4. Live Preview pane

- **Isolation**: `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups">` with `src` on `http://<run-id>.preview.localhost:<port>`; CSP `default-src 'self' <origin>; connect-src <origin> ws:<origin>`; storage partitioned per workspace (`partition = ws-<hash>`).
- **Hot reload**: dev server HMR websocket proxied through the host; if the server restarts, Preview shows an "Offline — server stopped" state with a *Restart* button.
- **Device sizes**: chips for 390 × 844, 768 × 1024, 1440 × 900, custom; rotate toggle; zoom 50–200 %.
- **Console / Network tabs**: captured via CDP (`Runtime.consoleAPICalled`, `Network.*`) when the preview is launched by Mesa; otherwise via an injected bridge script.
- **Open in browser**: system browser to the same URL (token-scoped, expires in 24 h).
- **Screenshot to chat** (`Ctrl+Shift+S`): captures the iframe, attaches to composer as an image with the URL and viewport metadata.
- **Send element back to agent**: inspector mode (`Ctrl+Shift+C`), click an element → `data-mesa-element` path + outerHTML snippet inserted into composer as an `@element` ref.

## 5. Gallery

- Persistent index in SQLite (`artifacts`, `pins`, `tags`, `comparisons`), content-addressed blobs on disk.
- Filters: kind, session, project, date range, tag, verification status.
- **Before/after**: select two versions of the same artifact path → side-by-side with "Animate diff" toggle.
- **Re-run with fresh inputs**: for canvases and Tasks, shows a parameter form; runs in the original session's workspace (or a fork) and adds the new version to the comparison.
- Share: publish a gallery item → read-only link (PublishDialog preflight).

## 6. Canvases

- A canvas is an HTML + JSON spec artifact produced by the agent (`present({ kind: 'canvas', file: 'x.canvas.html', inputs: {...} })`).
- Rendered in CanvasView beside chat (center split: thread | canvas, draggable) or in the dock.
- Saved to Gallery, re-runnable (inputs form), shareable, **skinnable via skills** (a skill can ship a theme that sets `--canvas-*` tokens).

## 7. Before/after & diff theatre

- **Diff reveal**: when a DiffViewer opens from a showcase, hunks fade in top-to-bottom with 80 ms stagger (purpose: orient the eye to the first change; off-switch: Appearance → Animated reveals).
- **Refactor animation**: for renames/moves, draw a 300 ms line from old to new position in split view (only when < 50 hunks).
- **"Explain this hunk"** button on each hunk → inserts `@hunk:<file>#L12-L30 Explain this change` into the composer and focuses it.

## 8. Delivery ceremony summary

| Effect | Trigger | Duration | Purpose | Off-switch |
|---|---|---|---|---|
| Showcase slide-in | Deliverables present | 360 ms | Direct attention to finished work | Appearance → Showcase windows → "Dock silently" |
| Card stagger | Showcase | 60 ms/card | Reading order | Reduced motion |
| Accent sweep | ≥ 3 deliverables, all verified | 900 ms | Mark *verified* completion | Appearance → Completion effects |
| Header glow | DND-minimised showcase | 4 s | Silent signal | Notifications → None |
| Confetti | Only via plugin | — | Team celebration | Uninstall plugin |
