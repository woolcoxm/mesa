import { useState, type FormEvent } from 'react';
import { Puzzle, Sparkles, Trash2, Plus, Wand2 } from 'lucide-react';
import { useStore } from '../state/useStore';
import { removeSkill, setPluginEnabled, toast, upsertSkill } from '../state/store';

const PLUGINS = [
  { id: 'mesa.run', name: 'Run console', desc: 'PTY terminals, background jobs, inline Run cards' },
  { id: 'mesa.preview', name: 'Preview', desc: 'Sandboxed iframe preview with console + network capture' },
  { id: 'mesa.showcase', name: 'Showcase', desc: 'Completion window, deliverable cards, Gallery' },
  { id: 'mesa.test-runner', name: 'Test runner', desc: 'Detects vitest / pytest and renders pass/fail trees' },
  { id: 'mesa.browser', name: 'Browser', desc: 'Browser tab with per-workspace storage' },
  { id: 'mesa.charts', name: 'Canvases & charts', desc: 'Agent-authored interactive views, re-runnable' },
  { id: 'mesa.notebook', name: 'Notebook runner', desc: 'Run cells with the server-configured interpreter' },
  { id: 'mesa.publish', name: 'Publish', desc: 'Preflight checks and local hosting for HTML deliverables' },
];

export function PluginsPage() {
  const st = useStore();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const isOn = (id: string) => st.settings.plugins?.[id] ?? true;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!n || !prompt.trim()) return toast('Skills need a one-word name and a prompt', 'warning');
    upsertSkill({ name: n, prompt: prompt.trim() });
    setName(''); setPrompt('');
  };
  const skills = st.settings.skills ?? [];
  return (
    <div className="page">
      <div className="page-head"><Puzzle size={16} /><b>Plugins</b><span className="muted">{PLUGINS.filter((p) => isOn(p.id)).length} enabled</span></div>
      <div className="plugin-list">{PLUGINS.map((p) => <div key={p.id} className={'plugin' + (isOn(p.id) ? ' on' : '')}><span className="plugin-icon"><Sparkles size={14} /></span><div><b>{p.name}</b><span className="tag">built-in</span><div className="set-sub">{p.desc}</div></div><button className={'switch' + (isOn(p.id) ? ' on' : '')} role="switch" aria-checked={isOn(p.id)} onClick={() => setPluginEnabled(p.id, !isOn(p.id))}><i /></button></div>)}</div>
      <div className="page-head" style={{ marginTop: 24 }}><Wand2 size={16} /><b>Skills</b><span className="muted" style={{ fontSize: 11 }}>{skills.length} saved · use as /name in the composer</span></div>
      <div className="set-sub" style={{ padding: '0 24px 12px' }}>A skill is a reusable prompt. Type <code>/name</code> in the composer and it expands into the prompt (anything you typed after the name is appended), so you can keep a house style for reviews, refactors or stand-ups.</div>
      <div className="skill-list">{skills.map((s) => <div key={s.id} className="automation"><span className="rs running" /><div className="auto-main"><b>/{s.name}</b><div className="set-sub"><i>{s.prompt}</i></div></div><button className="icon-btn sm" title="Delete skill" onClick={() => removeSkill(s.id)}><Trash2 size={13} /></button></div>)}{!skills.length && <div className="menu-empty" style={{ padding: '0 24px 12px' }}>No skills yet — add one below.</div>}</div>
      <form className="auto-form" onSubmit={submit} style={{ margin: '0 24px 24px' }}>
        <div className="set-section-title">New skill</div>
        <div className="af-grid" style={{ gridTemplateColumns: '1fr 3fr' }}>
          <label className="pf-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="review" /></label>
          <label className="pf-field"><span>Prompt</span><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Review the latest diff for bugs, then list risks and suggested fixes" /></label>
        </div>
        <div className="af-actions"><span className="spacer" /><button className="btn sm primary" type="submit"><Plus size={12} />Save skill</button></div>
      </form>
    </div>
  );
}
