// Client side of the ACP bridge: attaches an external agent (via scripts/serve.mjs) and translates its event stream into Mesa ledger blocks.
import type { Id, ToolCall } from '../state/types';
const uid = (): Id => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export interface AcpEvent {
  type: 'hello' | 'status' | 'thought' | 'chunk' | 'tool' | 'tool_update' | 'permission' | 'plan' | 'done' | 'error' | 'stderr';
  text?: string; toolCallId?: string; title?: string; kind?: string; status?: string; requestId?: string; command?: string; options?: { optionId: string; name: string; kind: string }[]; stopReason?: string; message?: string; entries?: unknown[]; attached?: boolean; code?: number;
}

export interface AcpHooks {
  appendText(text: string): void;
  appendThought(text: string): void;
  addTool(call: ToolCall): void;
  updateTool(callId: Id, patch: Partial<ToolCall>): void;
  requestPermission(args: { callId: Id; title: string; command: string; options: { optionId: string; name: string; kind: string }[] }): Promise<{ optionId: string }>;
  finish(result: { stopReason?: string; error?: string }): void;
  cancelToken(): { cancelled: boolean };
}

export async function acpStatus(): Promise<{ configured: boolean; command: string | null }> {
  try { const r = await fetch('/__mesa/acp/status', { cache: 'no-store' }); return r.ok ? await r.json() : { configured: false, command: null }; } catch { return { configured: false, command: null }; }
}

/** Runs one prompt against the ACP agent for a Mesa session. Resolves when the agent's turn ends (or errors). */
export async function runAcpPrompt(mesaSessionId: Id, text: string, hooks: AcpHooks): Promise<void> {
  const attach = await fetch('/__mesa/acp/attach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId }) }).catch(() => null);
  if (!attach || !attach.ok) { const msg = attach ? (await attach.json().catch(() => ({}))).error : 'ACP bridge unreachable'; hooks.finish({ error: msg ?? 'attach failed' }); return; }
  const token = hooks.cancelToken();
  await new Promise<void>((resolve) => {
    const es = new EventSource(`/__mesa/acp/events?session=${encodeURIComponent(mesaSessionId)}`);
    let settled = false;
    const done = (r: { stopReason?: string; error?: string }) => { if (settled) return; settled = true; es.close(); hooks.finish(r); resolve(); };
    es.onopen = () => { fetch('/__mesa/acp/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId, text }) }).catch(() => done({ error: 'prompt failed' })); };
    es.onerror = () => { if (!settled && token.cancelled) done({ stopReason: 'cancelled' }); };
    es.onmessage = async (e) => {
      const ev = JSON.parse(e.data) as AcpEvent;
      if (token.cancelled && !['done', 'status'].includes(ev.type)) return;
      switch (ev.type) {
        case 'thought': if (ev.text) hooks.appendThought(ev.text); break;
        case 'chunk': if (ev.text) hooks.appendText(ev.text); break;
        case 'tool': hooks.addTool({ id: ev.toolCallId ?? uid(), name: 'tool', title: ev.title ?? 'tool', subtitle: ev.kind ? `acp · ${ev.kind}` : 'acp', status: 'running', startedAt: Date.now(), runtime: 'host' }); break;
        case 'tool_update': hooks.updateTool(ev.toolCallId ?? '', { status: ev.status === 'completed' ? 'success' : ev.status === 'failed' ? 'error' : 'running', output: ev.text || undefined, endedAt: ev.status === 'completed' || ev.status === 'failed' ? Date.now() : undefined, ...(ev.status === 'failed' ? { error: ev.text || 'failed' } : {}) }); break;
        case 'permission': {
          const options = ev.options ?? [];
          const { optionId } = await hooks.requestPermission({ callId: ev.toolCallId ?? uid(), title: ev.title ?? 'Permission', command: ev.command ?? '', options });
          fetch('/__mesa/acp/permission', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId, requestId: ev.requestId, optionId }) }).catch(() => { /* ignore */ });
          break;
        }
        case 'done': done({ stopReason: ev.stopReason }); break;
        case 'error': done({ error: ev.message ?? 'agent error' }); break;
        case 'status': if (ev.status === 'exited' && !settled) done({ error: `agent exited (code ${ev.code ?? '?'})` }); break;
      }
    };
  });
}

export async function acpCancel(mesaSessionId: Id) { try { await fetch('/__mesa/acp/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaSessionId }) }); } catch { /* ignore */ } }
