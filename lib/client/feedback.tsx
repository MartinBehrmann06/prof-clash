'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Toast = { id: number; msg: string; kind: '' | 'err' };
const Ctx = createContext<(msg: string, kind?: '' | 'err') => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, kind: '' | 'err' = '') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toast-layer" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className={`toast ${t.kind}`} layout
              initial={{ opacity: 0, y: -16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: 'spring', bounce: 0.25, visualDuration: 0.35 }}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Little physics confetti burst (skipped with reduced motion) */
export function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 36) {
  if (reduced()) return;
  const colors = ['#ff3ea5', '#3ee6ff', '#8b5cff', '#ffcc4d', '#a6ff4d', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'spark';
    c.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
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
    setTimeout(() => c.remove(), 2500); // rAF pauses in background tabs — never leave sparks behind
  }
}
