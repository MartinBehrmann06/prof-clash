'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import { termLabel } from '@/lib/terms';
import type { Prof, ProfDetail } from '@/lib/types';
import { Portrait } from './Portrait';

type Ctx = { openId: number | null; open: (p: Prof) => void };
const ProfileCtx = createContext<Ctx>({ openId: null, open: () => {} });
export const useProfile = () => useContext(ProfileCtx);

/**
 * Professor profile overlay. Opened from a ranking row, the portrait travels from the row into the
 * profile (shared layoutId), so the profile is spatially tied to where it came from.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [prof, setProf] = useState<Prof | null>(null);
  const [detail, setDetail] = useState<ProfDetail | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const open = useCallback((p: Prof) => {
    trigger.current = document.activeElement as HTMLElement;
    setProf(p); setDetail(null);
    api<ProfDetail>(`/api/professors/${p.id}`).then((d) => setDetail((cur) => cur ?? d)).catch(() => {});
  }, []);
  const close = useCallback(() => { setProf(null); setTimeout(() => trigger.current?.focus?.(), 0); }, []);
  useEffect(() => {
    if (!prof) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [prof, close]);

  return (
    <ProfileCtx.Provider value={{ openId: prof?.id ?? null, open }}>
      {children}
      <AnimatePresence>
        {prof && <>
          <motion.div key="scrim" className="scrim" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={MOTION.fade} />
          <motion.div className="profile-wrap" key="wrap" exit={{ opacity: 0, pointerEvents: 'none', transition: MOTION.exit }}>
            <motion.section className="profile" role="dialog" aria-modal="true" aria-label={prof.name}
              style={{ ['--accent' as any]: deptByName(prof.department).color }}
              initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12, transition: MOTION.exit }}
              transition={MOTION.soft}>
              <button className="icon-btn close" onClick={close} aria-label="Schliessen" autoFocus>✕</button>
              <div className="side">
                <motion.div layoutId={`portrait-${prof.id}`} transition={MOTION.snappy} style={{ height: '100%' }}>
                  <Portrait p={prof} eager />
                </motion.div>
              </div>
              <ProfileBody p={detail && detail.id === prof.id ? detail : null} base={prof} />
            </motion.section>
          </motion.div>
        </>}
      </AnimatePresence>
    </ProfileCtx.Provider>
  );
}

function ProfileBody({ p, base }: { p: ProfDetail | null; base: Prof }) {
  const dept = deptByName(base.department);
  const duels = base.wins + base.losses;
  return (
    <motion.div className="body" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 0.08 }}>
      <div style={{ display: 'grid', gap: 6, paddingRight: 40 }}>
        <span className="badge"><span className="dot" />{dept.code} · {dept.id ? dept.name : base.department}</span>
        <h2 className="title">{base.name}</h2>
        <span className="muted" style={{ fontSize: '.9rem' }}>{base.field || base.relationship}</span>
      </div>
      <div className="stats">
        <div className="stat"><b className="num">{base.elo}</b><small>Elo</small></div>
        <div className="stat"><b className="num">{p ? `#${p.rank}` : '…'}</b><small>Rang gesamt</small></div>
        <div className="stat"><b className="num">{duels}</b><small>Duelle</small></div>
        <div className="stat"><b className="num">{duels ? `${Math.round((100 * base.wins) / duels)}%` : '–'}</b><small>Siegquote</small></div>
      </div>
      {p && p.depts.length > 0 && (
        <div className="list">
          <span className="eyebrow" style={{ marginBottom: 4 }}>Elo pro Department (nur Stimmen dieses Departments)</span>
          {p.depts.map((d) => <div key={d.name}><span>{d.name}</span><small className="num">{d.elo} · {d.wins}S {d.losses}N</small></div>)}
        </div>
      )}
      <div className="list">
        <span className="eyebrow" style={{ marginBottom: 4 }}>Pflichtveranstaltungen</span>
        {!p ? <div><span className="muted">Lädt …</span></div> : p.courses.map((c) => (
          <div key={c.program + c.title}><span>{c.title}</span><small>{c.program}{c.semester ? ` · Sem. ${c.semester}` : ''}{c.term ? ` · ${termLabel(c.term)}` : ''}</small></div>
        ))}
      </div>
      {base.url && <a className="btn ghost sm" href={base.url} target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'start' }}>Webseite ↗</a>}
    </motion.div>
  );
}
