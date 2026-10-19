'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { DEPARTMENTS, deptByName } from '@/lib/departments';
import { useProfile } from '@/components/Profile';
import { Portrait } from '@/components/Portrait';
import type { RankedProf } from '@/lib/types';

const REFRESH_MS = 15000; // rankings stay in sync; rank changes glide into place
const PAGE = 100;

export default function RankingsPage() {
  const { profile } = useSession();
  const { open, openId } = useProfile();
  const [scope, setScope] = useState<'all' | 'dept'>('all');
  const [dept, setDept] = useState<number>(profile?.deptId ?? 5);
  const [rows, setRows] = useState<RankedProf[] | null>(null);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { if (profile?.deptId) setDept(profile.deptId); }, [profile?.deptId]);
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
  const anyVotes = !!rows?.some((p) => p.wins + p.losses > 0);
  const deptName = DEPARTMENTS.find((d) => d.id === dept)?.name;

  return (
    <div className="page">
      <header className="head">
        <span className="eyebrow">Professoren-Elo</span>
        <h1 className="display">Rankings</h1>
        <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
          {scope === 'all'
            ? 'Gesamtwertung aus allen gezählten Duellen eingeloggter ETH-Studierender.'
            : `Nur Stimmen von Studierenden aus ${deptName} — jede Department-Wertung ist unabhängig.`}
        </p>
      </header>

      <div className="filters">
        <div className="seg" role="tablist" aria-label="Wertung">
          {(['all', 'dept'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)}>
              {scope === s && <motion.span layoutId="rank-seg" className="pill" transition={MOTION.snappy} />}
              {s === 'all' ? 'Gesamt' : 'Department'}
            </button>
          ))}
        </div>
        {scope === 'dept' && (
          <select className="select" aria-label="Department" value={dept} onChange={(e) => setDept(Number(e.target.value))}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>D-{d.code} · {d.name}</option>)}
          </select>
        )}
        <input className="input" type="search" placeholder="Professor suchen" aria-label="Professor suchen" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 200px', maxWidth: 320 }} />
      </div>

      <div className="table" role="table" aria-label="Rangliste">
        <div className="thead" role="row"><span>Rang</span><span>Professor</span><span>Department</span><span className="r">Elo</span><span className="r">Duelle</span></div>
        {!rows ? <div className="loading" style={{ minHeight: 240 }}><div className="spinner" />Lädt</div> : (
          <LayoutGroup>
            {!anyVotes && !q && <div className="empty">Noch keine gezählten Duelle in dieser Wertung — alle starten bei 1200.</div>}
            {list.length === 0 && q && <div className="empty">Keine Treffer.</div>}
            <AnimatePresence initial={false}>
              {list.slice(0, limit).map((p) => {
                const d = deptByName(p.department);
                const top = anyVotes && p.rank <= 3 && !q;
                return (
                  <motion.button key={p.id} type="button" role="row" className={`row ${top ? 'top' : ''}`} onClick={() => open(p)}
                    layout="position" transition={MOTION.soft}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: MOTION.fade }}>
                    <span className="rk num">{top ? <span className="medal">{p.rank}</span> : p.rank}</span>
                    <span className="who">
                      {openId === p.id ? <span className="portrait" style={{ width: 42, flex: 'none', borderRadius: 12, aspectRatio: '1' }} /> : (
                        <motion.div layoutId={`portrait-${p.id}`} transition={MOTION.snappy} style={{ width: 42, flex: 'none', borderRadius: 12, overflow: 'hidden' }}>
                          <Portrait p={p} />
                        </motion.div>
                      )}
                      <span><b>{p.name}</b><small>{p.field || p.relationship}</small></span>
                    </span>
                    <span className="d" style={{ ['--accent' as any]: d.color }}><span className="dot" /><span>D-{d.code}</span></span>
                    <span className="e num">{p.elo}</span>
                    <span className="n num">{p.wins + p.losses}</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
      {rows && list.length > limit && <div style={{ textAlign: 'center', marginTop: 16 }}><button className="btn ghost sm" onClick={() => setLimit(limit + PAGE)}>Weitere anzeigen</button></div>}
      <p className="legend">Elo = Bewertung der Professoren aus gezählten Duellen. Dein persönlicher Fortschritt (Level, deine Duelle) steht oben rechts und fliesst nicht in diese Zahlen ein. Training-Duelle ohne Anmeldung werden nicht gezählt.</p>
    </div>
  );
}
