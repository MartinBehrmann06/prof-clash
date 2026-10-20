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
import { ShareButton } from './Share';

/**
 * away: professors whose portrait is in an open or still-closing profile (their row shows an empty frame meanwhile).
 * portraitId: the shared layoutId a row gives its portrait so it can fly into the profile.
 */
type Ctx = { away: ReadonlySet<number>; portraitId: (id: number) => string; open: (p: Prof) => void };
const ProfileCtx = createContext<Ctx>({ away: new Set(), portraitId: (id) => `portrait-${id}`, open: () => {} });
export const useProfile = () => useContext(ProfileCtx);

/**
 * Professor profile overlay. Opened from a ranking row, the portrait travels from the row into the
 * profile (shared layoutId), so the profile is spatially tied to where it came from.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [prof, setProf] = useState<Prof | null>(null);
  const [detail, setDetail] = useState<ProfDetail | null>(null);
  const [away, setAway] = useState<ReadonlySet<number>>(new Set());
  // bumped once a profile has fully closed: the row's portrait comes back under a fresh layoutId,
  // otherwise Motion would fly it back from wherever the profile's portrait last was
  const [gen, setGen] = useState(0);
  const portraitId = useCallback((id: number) => `portrait-${id}-${gen}`, [gen]);
  const trigger = useRef<HTMLElement | null>(null);
  // the dialog itself takes focus (Escape and Tab work at once) instead of the close button, which showed a focus ring on every open
  const focusOnMount = useCallback((el: HTMLElement | null) => el?.focus({ preventScroll: true }), []);
  const current = useRef<number | null>(null);

  const open = useCallback((p: Prof) => {
    trigger.current = document.activeElement as HTMLElement;
    current.current = p.id;
    setProf(p); setDetail(null); setAway((s) => new Set(s).add(p.id));
    // a slow answer for a professor opened earlier must not take the place of this one's
    api<ProfDetail>(`/api/professors/${p.id}`).then((d) => { if (current.current === p.id) setDetail(d); }).catch(() => {});
  }, []);
  const close = useCallback(() => { current.current = null; setProf(null); setTimeout(() => trigger.current?.focus?.(), 0); }, []);
  useEffect(() => {
    if (!prof) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [prof, close]);

  return (
    <ProfileCtx.Provider value={{ away, portraitId, open }}>
      {children}
      {/* the portrait flies out of its row on open; on close the panel leaves first and the row gets its
          portrait back once it's gone, so nothing flies back underneath the fading scrim */}
      <AnimatePresence onExitComplete={() => { setAway(current.current == null ? new Set() : new Set([current.current])); if (current.current == null) setGen((g) => g + 1); }}>
        {prof && <>
          {/* the scrim stays one element, so reopening while it fades out just fades it back in */}
          <motion.div key="scrim" className="scrim" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={MOTION.fade} />
          {/* one panel per professor: opening another while the last one leaves gives a fresh panel, not a half-faded one */}
          <div className="profile-wrap" key={`wrap-${prof.id}`}>
            <motion.section className="panel profile" role="dialog" aria-modal="true" aria-label={prof.name} tabIndex={-1} ref={focusOnMount}
              style={{ ['--accent' as any]: deptByName(prof.department).color }}
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0, pointerEvents: 'auto' }}
              exit={{ opacity: 0, scale: 0.97, y: 8, pointerEvents: 'none', transition: MOTION.exit }}
              transition={{ ...MOTION.soft, opacity: MOTION.fade }}>
              <button className="btn sm red icon-only close" onClick={close} aria-label="Schliessen"><Icon name="close" size={22} className="icon x" /></button>
              {/* radius inline and the figure as its own layout box, so Motion keeps both undistorted on the way */}
              <motion.div layoutId={portraitId(prof.id)} transition={MOTION.snappy} className="frame" style={{ borderRadius: 16 }}>
                <motion.span layoutId={`${portraitId(prof.id)}-fig`} transition={MOTION.snappy} className="fig">
                  <Figure id={prof.id} name={prof.name} department={prof.department} mood="happy" />
                </motion.span>
              </motion.div>
              <ProfileBody p={detail && detail.id === prof.id ? detail : null} base={prof} />
            </motion.section>
          </div>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION.fade}>
      <div className="profile-head">
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
        <ShareButton path={`/p/${base.id}`} text={`${base.name} auf Prof Clash. Wen findest du besser?`} />
        <a className="link-quiet" href="/impressum#entfernen">Sind Sie das? Eintrag entfernen lassen</a>
      </p>
    </motion.div>
  );
}
