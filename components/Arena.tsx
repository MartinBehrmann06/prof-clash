'use client';
import { useEffect, useRef } from 'react';

/**
 * The arena behind every page: spotlights, a neon grid floor and slowly rising embers.
 * The ember canvas pauses when the tab is hidden and is skipped for reduced motion.
 */
export function Arena() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const colors = ['255,62,165', '62,230,255', '139,92,255', '255,204,77'];
    type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; c: string };
    let w = 0, h = 0, raf = 0, parts: P[] = [];
    const spawn = (y?: number): P => ({
      x: Math.random() * w, y: y ?? h + 10, r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.15, a: 0.2 + Math.random() * 0.6,
      c: colors[Math.floor(Math.random() * colors.length)],
    });
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: Math.round((w * h) / 22000) }, () => spawn(Math.random() * h));
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy; p.x += p.vx;
        if (p.y < -10) Object.assign(p, spawn());
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.c},${p.a * Math.min(1, p.y / (h * 0.3))})`;
        ctx.shadowColor = `rgba(${p.c},1)`; ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); };
    resize(); raf = requestAnimationFrame(tick);
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div className="arena-bg" aria-hidden="true">
      <div className="arena-spot l" /><div className="arena-spot r" />
      <div className="arena-floor" />
      <canvas ref={canvas} />
      <div className="vignette" />
    </div>
  );
}
