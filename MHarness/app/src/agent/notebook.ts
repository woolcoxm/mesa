// Notebook execution: cells run in one interpreter process configured on the server ("notebook": { "command": "python" } in mesa.config.json).
export interface NotebookRunResult { cells: { output: string; failed: boolean }[]; exitCode: number; stderr: string; ms: number; error?: string }

export async function notebookStatus(): Promise<{ configured: boolean; command: string | null }> {
  try { const r = await fetch('/__mesa/notebook/status', { cache: 'no-store' }); return r.ok ? await r.json() : { configured: false, command: null }; } catch { return { configured: false, command: null }; }
}

/** Runs the given cell sources in order, in one process, and returns one output per cell. Timeouts and output caps are enforced by the server. */
export async function runNotebookCells(sources: string[]): Promise<NotebookRunResult> {
  try {
    const r = await fetch('/__mesa/notebook/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cells: sources }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { cells: sources.map(() => ({ output: '', failed: true })), exitCode: -1, stderr: '', ms: 0, error: j.error ?? `HTTP ${r.status}` };
    return j;
  } catch (e) { return { cells: sources.map(() => ({ output: '', failed: true })), exitCode: -1, stderr: '', ms: 0, error: e instanceof Error ? e.message : String(e) }; }
}
