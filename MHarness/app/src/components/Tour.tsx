import { useEffect, useState } from 'react';
import { useStore } from '../state/useStore';
import { setTour, updateSettings } from '../state/store';
import { sc } from '../state/platform';

interface Step { selector: string; title: string; body: string; align?: 'left' | 'right' | 'top' | 'bottom' }
const STEPS: Step[] = [
  { selector: '.rail', title: 'Sessions & navigation', body: 'Every conversation is a session with a state dot. Search matches titles and message content. Below: Agents, Automations, Gallery, Plugins and Settings.', align: 'right' },
  { selector: '.composer', title: 'Steer the agent', body: `Enter sends · Shift+Enter injects at the next tool call · Alt+Enter queues. Type / for commands and @ for files. When the agent needs permission, this box becomes the approval.`, align: 'top' },
  { selector: '.hdr-left', title: 'Modes & permissions', body: 'Plan / Build / Auto changes how much the agent does on its own. The permission preset (read-only · workspace write · full access) decides what needs your approval.', align: 'bottom' },
  { selector: '.dock', title: 'Everything the agent produces lands here', body: 'Artifacts & diffs, a real terminal, live previews, files, agents, stats and the event timeline. Drag the edge to resize; Ctrl+1…8 jump between tabs.', align: 'left' },
  { selector: '.rail-search', title: 'Command palette', body: `Press ${sc('Ctrl+K')} anywhere for every action: tabs, modes, themes, demos and sessions. Esc closes anything.`, align: 'right' },
];

export function Tour() {
  const st = useStore();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = st.tour === null ? null : STEPS[st.tour];
  useEffect(() => {
    const i = st.tour;
    if (i === null) return;
    const el = document.querySelector(STEPS[i].selector);
    if (!el) { next(i); return; }
    const measure = () => { const r = el.getBoundingClientRect(); setRect(new DOMRect(r.x - 6, r.y - 6, r.width + 12, r.height + 12)); };
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); } if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next(i); } if (e.code === 'ArrowLeft') { e.preventDefault(); setTour(Math.max(0, i - 1)); } if (e.code === 'ArrowRight') { e.preventDefault(); next(i); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey, true); };
  }, [st.tour]);
  if (step === null || !rect) return null;
  const align = step.align ?? 'bottom';
  const cardStyle: React.CSSProperties = align === 'right' ? { left: rect.right + 16, top: Math.max(16, rect.top) } : align === 'left' ? { right: window.innerWidth - rect.left + 16, top: Math.max(16, rect.top) } : align === 'top' ? { left: Math.max(16, Math.min(rect.left, window.innerWidth - 380)), top: rect.top - 16, transform: 'translateY(-100%)' } : { left: Math.max(16, Math.min(rect.left, window.innerWidth - 380)), top: rect.bottom + 16 };
  return (
    <div className="tour" role="dialog" aria-label="Guided tour">
      <div className="tour-spot" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
      <div className={'tour-card tour-' + align} style={cardStyle} key={st.tour}>
        <div className="tour-step">Step {(st.tour ?? 0) + 1} of {STEPS.length}</div>
        <div className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>
        <div className="tour-actions">
          <button className="link-btn" onClick={finish}>Skip tour</button>
          <span className="spacer" />
          {(st.tour ?? 0) > 0 && <button className="btn sm ghost" onClick={() => setTour((st.tour ?? 1) - 1)}>Back</button>}
          <button className="btn sm primary" onClick={() => next(st.tour ?? 0)}>{(st.tour ?? 0) === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
        <div className="tour-hint"><kbd>→</kbd> next · <kbd>←</kbd> back · <kbd>Esc</kbd> skip</div>
      </div>
    </div>
  );
}
function next(i: number) { if (i + 1 >= STEPS.length) finish(); else setTour(i + 1); }
function finish() { setTour(null); updateSettings({ tourDone: true }); }

/** Replay entry point used by Settings and the palette. */
export function startTour() { setTour(0); }
