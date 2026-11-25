import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Copy, Trash2 } from 'lucide-react';
import { toast } from '../state/store';

interface Props { label: string; children: ReactNode; resetKey?: string }
interface State { error: Error | null; info: ErrorInfo | null }

/** Keeps a rendering bug inside one pane: the pane shows a recovery card, the rest of the shell keeps working. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };
  static getDerivedStateFromError(error: Error): State { return { error, info: null }; }
  componentDidCatch(error: Error, info: ErrorInfo) { this.setState({ info }); console.error(`[mesa] ${this.props.label} crashed`, error, info.componentStack); }
  componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, info: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const details = `${this.state.error.message}\n${(this.state.info?.componentStack ?? '').split('\n').slice(0, 6).join('\n')}`;
    return (
      <div className="crash-card" role="alert">
        <div className="crash-icon"><AlertTriangle size={18} /></div>
        <b>{this.props.label} hit an error</b>
        <div className="set-sub">The rest of Mesa is fine. You can retry this pane, copy the details for a bug report, or reset the workspace if it keeps happening.</div>
        <pre className="crash-details">{this.state.error.message}</pre>
        <div className="crash-actions">
          <button className="btn sm primary" onClick={() => this.setState({ error: null, info: null })}><RotateCcw size={12} />Retry</button>
          <button className="btn sm ghost" onClick={async () => { try { await navigator.clipboard.writeText(`**${this.props.label}**\n\`\`\`\n${details}\n\`\`\``); toast('Error details copied', 'success'); } catch { toast('Clipboard unavailable', 'warning'); } }}><Copy size={12} />Copy details</button>
          {this.props.resetKey === 'workspace' ? null : <button className="btn sm ghost danger" onClick={() => { if (window.confirm('Reset the workspace? Saved sessions and settings are cleared, then the demo reloads.')) { try { localStorage.removeItem('mesa.state.v2'); } catch { /* ignore */ } fetch('/__mesa/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"sessions":[],"settings":{}}' }).finally(() => location.reload()); } }}><Trash2 size={12} />Reset workspace</button>}
        </div>
      </div>
    );
  }
}
