'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { api } from '@/lib/client/session';
import { project, spring } from '@/lib/client/motion';
import { termLabel } from '@/lib/terms';
import type { ProfDetail } from '@/lib/types';
import { LeagueBadge, Portrait, Trophies } from './art';

const Ctx = createContext<(id: number) => void>(() => {});
export const useOpenProf = () => useContext(Ctx);

/** Bottom sheet with professor details; drag the grabber down (or flick) to dismiss */
export function ProfSheetProvider({ children }: { children: React.ReactNode }) {
  const [prof, setProf] = useState<ProfDetail | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const open = useCallback(async (id: number) => {
    trigger.current = document.activeElement as HTMLElement;
    setProf(await api<ProfDetail>(`/api/professors/${id}`));
  }, []);
  const close = useCallback(() => { setProf(null); trigger.current?.focus?.(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <Ctx.Provider value={open}>
      {children}
      <AnimatePresence>{prof && <Sheet key={prof.id} p={prof} onClose={close} />}</AnimatePresence>
    </Ctx.Provider>
  );
}

function Sheet({ p, onClose }: { p: ProfDetail; onClose: () => void }) {
  const drag = useDragControls();
  const ref = useRef<HTMLElement>(null);
  const winRate = p.wins + p.losses ? `${Math.round((100 * p.wins) / (p.wins + p.losses))}%` : '—';
  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.section
        ref={ref} className={`sheet`} role="dialog" aria-modal="true" aria-label={`${p.name} details`}
        style={{ x: '-50%', ['--rc' as any]: `var(--r-${p.league})` }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring(1, 0.35)}
        drag="y" dragListener={false} dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.08, bottom: 1 }}
        onDragEnd={(_, info) => {
          // decide by where the flick is going, not where the finger stopped
          const h = ref.current?.offsetHeight || 500;
          if (info.offset.y + project(info.velocity.y) > h * 0.4) onClose();
        }}
      >
        <div className="grab-zone" onPointerDown={(e) => drag.start(e)}><div className="grabber" /></div>
        <button className="icon-btn close" onClick={onClose} aria-label="Close" autoFocus>✕</button>
        <div className="sheet-body">
          <div className="sheet-top">
            <Portrait p={p} />
            <div>
              <span className="eyebrow">#{p.rank} global</span>
              <h2>{p.name}</h2>
              <div className="meta">{p.relationship}{p.department ? ` · ${p.department}` : ''}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <LeagueBadge league={p.league} style={{ width: 44, height: 50, margin: 0 }} />
                <Trophies n={p.elo} />
              </div>
            </div>
          </div>
          <h4>Battle record</h4>
          <div className="rows">
            <div><span>Wins / Losses</span><b>{p.wins} / {p.losses}</b></div>
            <div><span>Win rate</span><b>{winRate}</b></div>
          </div>
          {p.depts.length > 0 && <>
            <h4>Department ladders</h4>
            <div className="rows">{p.depts.map((d) => <div key={d.name}><span>{d.name}</span><span><Trophies n={d.elo} /> <small>{d.wins}W·{d.losses}L</small></span></div>)}</div>
          </>}
          <h4>Mandatory courses</h4>
          <div className="rows">
            {p.courses.map((c) => (
              <div key={c.program + c.title}><span>📘 {c.title}</span>
                <small>{c.program}{c.semester ? ` · Sem ${c.semester}` : ''}{c.term ? ` · ${termLabel(c.term)}` : ''}</small></div>
            ))}
          </div>
          {p.url && <p style={{ marginTop: 18 }}><a href={p.url} target="_blank" rel="noopener noreferrer">Website ↗</a></p>}
        </div>
      </motion.section>
    </>
  );
}
