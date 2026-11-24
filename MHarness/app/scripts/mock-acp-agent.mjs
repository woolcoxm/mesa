#!/usr/bin/env node
// Mock ACP (Agent Client Protocol) agent: newline-delimited JSON-RPC 2.0 over stdio, used to exercise Mesa's ACP bridge.
// Prompt text starting with "tool:" forces a tool call; "perm:" forces a permission request; otherwise a plain streamed answer.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const notify = (sessionId, update) => send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update } });
let nextTool = 1;
const pendingPermissions = new Map();
let cancelled = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function prompt(params) {
  const { sessionId, prompt: blocks } = params;
  const text = (blocks ?? []).map((b) => b.text ?? '').join(' ');
  const chunk = (content) => notify(sessionId, { sessionUpdate: 'agent_message_chunk', content });
  const thought = (textValue) => notify(sessionId, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: textValue } });
  cancelled.delete(sessionId);
  thought('The user wants a demonstration of the ACP bridge. I will answer, use a tool when asked, and ask permission for shell commands.');
  await sleep(150);
  const words = `ACP bridge online — I am ${process.argv[1] ? 'the mock agent' : 'an agent'} and Mesa is driving me over stdio. You said: "${text}".`.split(' ');
  for (let i = 0; i < Math.min(6, words.length); i++) { if (cancelled.has(sessionId)) return 'cancelled'; chunk({ type: 'text', text: words[i] + ' ' }); await sleep(40); }
  if (/tool:|perm:/.test(text)) {
    const toolCallId = 'tool-' + nextTool++;
    notify(sessionId, { sessionUpdate: 'tool_call', toolCallId, title: 'bash: echo hello from ACP', kind: 'execute', status: 'pending' });
    await sleep(200);
    if (/perm:/.test(text)) {
      const id = 'perm-' + toolCallId;
      send({ jsonrpc: '2.0', id, method: 'session/request_permission', params: { sessionId, toolCall: { toolCallId, title: 'bash: echo hello from ACP', kind: 'execute', rawInput: { command: 'echo hello from ACP' } }, options: [{ optionId: 'allow', name: 'Allow once', kind: 'allow_once' }, { optionId: 'reject', name: 'Reject', kind: 'reject_once' }] } });
      const outcome = await new Promise((resolve) => pendingPermissions.set(id, resolve));
      if (outcome !== 'allow') { notify(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: 'failed', content: [{ type: 'content', content: { type: 'text', text: 'Denied by user' } }] }); chunk({ type: 'text', text: 'Understood — I did not run it.' }); return 'end_turn'; }
    }
    notify(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: 'in_progress' });
    await sleep(250);
    notify(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'hello from ACP' } }] });
  }
  for (const w of words.slice(6)) { if (cancelled.has(sessionId)) return 'cancelled'; chunk({ type: 'text', text: w + ' ' }); await sleep(25); }
  return 'end_turn';
}

rl.on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'initialize') return reply(msg.id, { protocolVersion: 1, agentCapabilities: { loadSession: false, promptCapabilities: { image: false, audio: false }, mcpCapabilities: {} }, authMethods: [] });
  if (msg.method === 'session/new') return reply(msg.id, { sessionId: 'acp-' + Math.random().toString(36).slice(2, 10) });
  if (msg.method === 'session/prompt') { const stopReason = await prompt(msg.params); return reply(msg.id, { stopReason }); }
  if (msg.method === 'session/cancel') { cancelled.add(msg.params.sessionId); return reply(msg.id, {}); }
  // A response to one of our permission requests.
  if (msg.id !== undefined && msg.result !== undefined && pendingPermissions.has(msg.id)) { pendingPermissions.get(msg.id)(msg.result?.outcome?.optionId); pendingPermissions.delete(msg.id); return; }
  if (msg.id !== undefined) reply(msg.id, {});
});
process.stdout.on('error', () => process.exit(0));
