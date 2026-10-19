'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/client/session';
import { MIN_DUELS } from '@/lib/game';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import { termLabel } from '@/lib/terms';
import type { Prof, ProfDetail } from '@/lib/types';
import { Figure } from './Figure';
import { Icon, LeagueBadge, Trophies } from './art';

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
            <motion.section className="panel profile" role="dialog" aria-modal="true" aria-label={prof.name}
              style={{ ['--accent' as any]: deptByName(prof.department).color }}
              initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12, transition: MOTION.exit }}
              transition={MOTION.soft}>
              <button className="btn sm stone icon-only close" onClick={close} aria-label="Schliessen" autoFocus><Icon name="close" /></button>
              <motion.div layoutId={`portrait-${prof.id}`} transition={MOTION.snappy} className="frame">
                <Figure id={prof.id} name={prof.name} department={prof.department} mood="happy" />
              </motion.div>
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
  const rated = duels >= MIN_DUELS; // fewer duels are noise, so no number is shown yet
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 0.08 }}>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
        <span className="chip"><i className="dot" style={{ ['--c' as any]: dept.color }} />{dept.code} · {dept.id ? dept.name : base.department}</span>
        <h2>{base.name}</h2>
        <span className="muted" style={{ fontSize: 14 }}>{base.field || base.relationship}</span>
        {rated
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LeagueBadge league={base.league} style={{ width: 40, height: 46 }} /><Trophies n={base.elo} /></span>
          : <span className="chip unranked">Neu · Rang ab {MIN_DUELS} Duellen</span>}
      </div>
      <div className="stats">
        <div className="stat"><b className="num">{rated ? base.elo : '–'}</b><small>Trophäen</small></div>
        <div className="stat"><b className="num">{!p ? '…' : p.rank != null ? `#${p.rank}` : '–'}</b><small>Rang gesamt</small></div>
        <div className="stat"><b className="num">{duels}</b><small>Duelle</small></div>
        <div className="stat"><b className="num">{rated ? `${Math.round((100 * base.wins) / duels)}%` : '–'}</b><small>Siegquote</small></div>
      </div>
      {p && p.depts.some((d) => d.wins + d.losses >= MIN_DUELS) && (
        <div className="list">
          <span className="h"><Icon name="shield" size={16} /> Pro Clan (nur Stimmen dieses Departments)</span>
          {p.depts.filter((d) => d.wins + d.losses >= MIN_DUELS).map((d) => <div key={d.name}><span>{d.name}</span><small className="num">{d.elo} · {d.wins}S {d.losses}N</small></div>)}
        </div>
      )}
      <div className="list">
        <span className="h"><Icon name="book" size={16} /> Pflichtfächer</span>
        {!p ? <div><span className="muted">Lädt …</span></div> : p.courses.map((c) => (
          <div key={c.program + c.title}><span>{c.title}</span><small>{c.program}{c.semester ? ` · Sem. ${c.semester}` : ''}{c.term ? ` · ${termLabel(c.term)}` : ''}</small></div>
        ))}
      </div>
      <p style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {base.url && <a className="btn sm blue" href={base.url} target="_blank" rel="noopener noreferrer">Webseite <Icon name="external" size={15} /></a>}
        <a className="link-quiet" href="/impressum#entfernen">Sind Sie das? Eintrag entfernen lassen</a>
      </p>
    </motion.div>
  );
}
