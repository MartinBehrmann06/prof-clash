'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; msg: string; kind: '' | 'err'; out?: boolean };
const Ctx = createContext<(msg: string, kind?: '' | 'err') => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, kind: '' | 'err' = '') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x))), 2200);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toast-layer" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind} ${t.out ? 'out' : ''}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Little physics confetti burst (skipped with reduced motion) */
export function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 36) {
  if (reduced()) return;
  const colors = ['#ffd23f', '#2f95e6', '#e8402a', '#4fbf20', '#c13edc', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.background = colors[i % colors.length];
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    document.body.append(c);
    const ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 10;
    let vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - 8, px = 0, py = 0, rot = 0, life = 0;
    const step = () => {
      vy += 0.45; vx *= 0.985; px += vx; py += vy; rot += vx * 3; life++;
      c.style.transform = `translate(${px}px, ${py}px) rotate(${rot}deg)`;
      c.style.opacity = String(1 - life / 90);
      if (life < 90) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }
}
