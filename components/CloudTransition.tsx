'use client';
// Clash-style loading clouds between pages: two flat cloud banks close in from the sides,
// the route changes behind them, and they part again along the same path.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';

type Go = (href: string, label?: string) => void;
const Ctx = createContext<Go>(() => {});
export const useGo = () => useContext(Ctx);

const PUFFS = [ // [x%, y%, size vmax] for one bank; mirrored for the other
  [10, 4, 30], [42, 10, 26], [72, 2, 22], [18, 34, 34], [55, 32, 30], [84, 28, 24],
  [8, 64, 30], [40, 60, 34], [74, 58, 28], [22, 88, 30], [58, 86, 26], [88, 82, 22],
];
const CLOSE_MS = 420;

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

  // the new page is mounted → part the clouds
  useEffect(() => {
    if (target.current && path === target.current.split('?')[0]) {
      target.current = null;
      const t = setTimeout(() => setState('open'), 120);
      return () => clearTimeout(t);
    }
  }, [path]);

  const closed = state === 'closed';
  return (
    <Ctx.Provider value={go}>
      {children}
      <div className="wipe" aria-hidden={!closed}>
        {(['l', 'r'] as const).map((side) => (
          <motion.div key={side} className={`bank ${side}`} initial={false}
            // `transform`, not `x`: Motion hands it to the compositor, so the clouds keep moving smoothly
            // while the next page is being built on the main thread behind them
            animate={{ transform: `translateX(${closed ? '0%' : side === 'l' ? '-115%' : '115%'})` }}
            transition={{ type: 'spring', bounce: 0, visualDuration: closed ? 0.4 : 0.5 }}>
            {PUFFS.map(([x, y, s], i) => (
              <span key={i} className="puff" style={{ left: `${side === 'l' ? x : 100 - x}%`, top: `${y}%`, width: `${s}vmax`, height: `${s}vmax`, translate: '-50% -50%' }} />
            ))}
          </motion.div>
        ))}
        {closed && label && <motion.div className="label" initial={{ transform: 'scale(0.6)', opacity: 0 }} animate={{ transform: 'scale(1)', opacity: 1 }} transition={{ type: 'spring', bounce: 0.45, visualDuration: 0.3, delay: 0.25 }}>{label}</motion.div>}
      </div>
    </Ctx.Provider>
  );
}

/** Internal link that travels through the clouds */
export function GameLink({ href, label, className, children, ...rest }: { href: string; label?: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = useGo();
  return (
    <a href={href} className={className} {...rest}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); go(href, label); }}>
      {children}
    </a>
  );
}
