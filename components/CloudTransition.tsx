'use client';
// Page transition: a blue and a coral panel close in from the sides, meet at a slanted seam,
// the route changes behind them, and they part again along the same path.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';

type Go = (href: string, label?: string) => void;
const Ctx = createContext<Go>(() => {});
export const useGo = () => useContext(Ctx);

const CLOSE_MS = 380;

export function CloudTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const reduced = useReducedMotion();
  const [state, setState] = useState<'open' | 'closed'>('open');
  const [label, setLabel] = useState('');
  const target = useRef<string | null>(null);

  const go: Go = useCallback((href, l = '') => {
    if (href === path) return;
    if (reduced) { router.push(href); return; }
    target.current = href;
    setLabel(l);
    setState('closed');
    router.prefetch(href);
    setTimeout(() => router.push(href), CLOSE_MS);
    setTimeout(() => { if (target.current) { target.current = null; setState('open'); } }, 2500); // safety net
  }, [path, reduced, router]);

  // the new page is mounted → open the panels
  useEffect(() => {
    if (target.current && path === target.current.split('?')[0]) {
      target.current = null;
      const t = setTimeout(() => setState('open'), 100);
      return () => clearTimeout(t);
    }
  }, [path]);

  const closed = state === 'closed';
  return (
    <Ctx.Provider value={go}>
      {children}
      <div className="wipe" aria-hidden={!closed}>
        {(['l', 'r'] as const).map((side) => (
          <motion.div key={side} className={`half ${side}`} initial={false}
            animate={{ x: closed ? '0%' : side === 'l' ? '-105%' : '105%' }}
            transition={{ type: 'spring', bounce: 0, visualDuration: closed ? 0.36 : 0.45 }} />
        ))}
        {closed && label && <motion.div className="label" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.3, visualDuration: 0.3, delay: 0.2 }}>{label}</motion.div>}
      </div>
    </Ctx.Provider>
  );
}

/** Internal link that travels through the page transition */
export function GameLink({ href, label, className, children, ...rest }: { href: string; label?: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = useGo();
  return (
    <a href={href} className={className} {...rest}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); go(href, label); }}>
      {children}
    </a>
  );
}
