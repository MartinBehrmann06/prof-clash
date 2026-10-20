'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { DEPARTMENTS, deptByName } from '@/lib/departments';
import { useProfile } from '@/components/Profile';
import { Figure } from '@/components/Figure';
import { Icon, LeagueBadge, Trophies } from '@/components/art';
import { MIN_DUELS } from '@/lib/game';
import type { ProfDetail, RankedProf } from '@/lib/types';

const REFRESH_MS = 15000; // rankings stay in sync; rank changes glide into place
const PAGE = 50;

export default function RankingsPage() {
  const { profile } = useSession();
  const { open, away, portraitId } = useProfile();
  const [scope, setScope] = useState<'all' | 'dept'>('all');
  const [dept, setDept] = useState<number>(profile?.deptId ?? 5);
  const [rows, setRows] = useState<RankedProf[] | null>(null);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { if (profile?.deptId) setDept(profile.deptId); }, [profile?.deptId]);
  // a shared link (/p/<id>) lands here with ?prof=<id>: open that profile once
  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get('prof'));
    if (!id) return;
    history.replaceState(null, '', location.pathname);
    api<ProfDetail>(`/api/professors/${id}`).then(open).catch(() => {});
  }, [open]);
  useEffect(() => {
    let alive = true;
    const url = scope === 'all' ? '/api/leaderboard?limit=1000' : `/api/leaderboard?scope=dept&dept=${dept}&limit=1000`;
    const load = () => api<RankedProf[]>(url).then((r) => { if (alive) setRows(r); }).catch(() => {});
    setRows(null); setLimit(PAGE); load();
    const t = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, [scope, dept]);

  const list = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter((p) => `${p.name} ${p.department} ${p.field}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);
  const deptName = DEPARTMENTS.find((d) => d.id === dept)?.name;

  return (
    <div className="page">
      <header className="head">
        <h1><span className="title-badge" style={{ ['--tb' as any]: 'var(--gold-2)' }}><Icon name="trophy" /></span>Rankings</h1>
        <p>{scope === 'all' ? 'Trophäen aller Profs aus gezählten Duellen eingeloggter ETH-Studierender.' : `Nur Stimmen aus dem Clan ${deptName} — jede Clan-Wertung ist unabhängig.`}</p>
        <div className="tabs" role="tablist" aria-label="Wertung">
          {(['all', 'dept'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)}>
              {scope === s && <motion.span layoutId="rank-tab" className="pill" transition={MOTION.snappy} />}
              {s === 'all' ? <><Icon name="globe" size={16} /> Gesamt</> : <><Icon name="shield" size={16} /> Clan</>}
            </button>
          ))}
        </div>
      </header>

      <div className="tools">
        {scope === 'dept' && (
          <select className="select" aria-label="Clan" value={dept} onChange={(e) => setDept(Number(e.target.value))}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>D-{d.code} · {d.name}</option>)}
          </select>
        )}
        <label className="search"><Icon name="search" /><input className="input" type="search" placeholder="Prof suchen" aria-label="Professor suchen" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} /></label>
      </div>

      <div className="panel board">
        <span className="ribbon">{scope === 'all' ? 'Hall of Fame' : `Clan D-${DEPARTMENTS.find((d) => d.id === dept)?.code}`}</span>
        {!rows ? <div className="loading" style={{ minHeight: 240 }}><span className="spin" /></div> : (
          <LayoutGroup>
            {!rows.some((p) => p.rank != null) && !q && <div className="empty">Noch niemand hat {MIN_DUELS} gezählte Duelle — dann gibt es die ersten Ränge.</div>}
            {list.length === 0 && q && <div className="empty">Keine Treffer.</div>}
            <AnimatePresence initial={false}>
              {list.slice(0, limit).map((p) => {
                const d = deptByName(p.department);
                const top = p.rank != null && p.rank <= 3 && !q;
                return (
                  <motion.button key={p.id} type="button" className={`row ${top ? 'top' : ''}`} onClick={() => open(p)}
                    layout="position" transition={MOTION.soft} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: MOTION.fade }}>
                    <span className="rk num">{top ? <span className={`medal m${p.rank}`}>{p.rank}</span> : p.rank ?? '–'}</span>
                    {away.has(p.id) ? <span className="frame round" /> : (
                      <motion.span layoutId={portraitId(p.id)} transition={MOTION.snappy} className="frame round" style={{ borderRadius: '50%' }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <motion.span layoutId={`${portraitId(p.id)}-fig`} transition={MOTION.snappy} className="fig">
                          <Figure id={p.id} name={p.name} department={p.department} />
                        </motion.span>
                      </motion.span>
                    )}
                    <span className="who"><b>{p.name}</b><small><i className="dot" style={{ ['--c' as any]: d.color }} />D-{d.code} · {p.field || p.relationship}</small></span>
                    {p.rank != null ? <><LeagueBadge league={p.league} /><Trophies n={p.elo} /></> : <span className="chip unranked" title={`Rang ab ${MIN_DUELS} Duellen`}>Neu</span>}
                    <span className="n num">{p.wins + p.losses} Duelle</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
      {rows && list.length > limit && <div style={{ textAlign: 'center', marginTop: 18 }}><button className="btn sm blue" onClick={() => setLimit(limit + PAGE)}>Mehr anzeigen</button></div>}
      <p className="legend">Trophäen = Elo der Profs. Einen Rang gibt es erst ab {MIN_DUELS} gezählten Duellen; wer weniger hat, steht als „Neu“ alphabetisch darunter. Dein eigener Fortschritt (Level ⭐) steht oben rechts und zählt hier nicht mit. Training-Duelle ohne Login werden nicht gezählt.</p>
    </div>
  );
}
