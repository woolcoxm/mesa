import { useEffect, useRef } from 'react';
import { useStore } from '../state/useStore';

interface P { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; life: number; shape: 0 | 1 | 2; s: number }

/** Lightweight canvas confetti fired from the showcase corner. Purpose: mark a *verified* multi-deliverable completion. Off-switch: Settings → Completion effects. */
export function Confetti() {
  const st = useStore();
  const ref = useRef<HTMLCanvasElement>(null);
  const fire = st.confetti;
  useEffect(() => {
    if (!fire || !ref.current) return;
    const canvas = ref.current; const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = ['--mesa-accent', '--mesa-info', '--mesa-success', '--mesa-warning', '#c084fc'].map((v) => css.getPropertyValue(v).trim() || '#7c86ff');
    const parts: P[] = Array.from({ length: 140 }, () => { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4; const sp = 6 + Math.random() * 10; return { x: fire.x + (Math.random() - 0.5) * 420, y: fire.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 5, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)], life: 1, shape: Math.floor(Math.random() * 3) as 0 | 1 | 2, s: 0.6 + Math.random() * 0.8 }; });
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const el = (now - t0) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life = Math.max(0, 1 - el / 1.7);
        ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.scale(1, p.shape === 1 ? 0.45 : 1);
        if (p.shape === 2) { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.r * p.s, -p.r * 0.5, p.r * 2 * p.s, p.r);
        ctx.restore();
      }
      if (el < 1.8) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  if (!st.settings.effects) return null;
  return <canvas ref={ref} className="confetti" aria-hidden="true" style={{ width: '100vw', height: '100vh' }} />;
}
