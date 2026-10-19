'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { spring } from '@/lib/client/motion';
import { LeagueBadge, Portrait, Trophies } from '@/components/art';
import { Podium } from '@/components/Podium';
import { useOpenProf } from '@/components/ProfSheet';
import type { Meta, RankedProf } from '@/lib/types';

export default function LeaderboardPage() {
  const { profile } = useSession();
  const open = useOpenProf();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scope, setScope] = useState<'global' | 'dept'>('global');
  const [dept, setDept] = useState<number | null>(null);
  const [rows, setRows] = useState<RankedProf[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { api<Meta>('/api/meta').then(setMeta); }, []);
  useEffect(() => { if (meta && dept == null) setDept(profile?.deptId ?? meta.depts[0].id); }, [meta, profile, dept]);
  useEffect(() => {
    if (scope === 'dept' && dept == null) return;
    setRows(null);
    api<RankedProf[]>(scope === 'global' ? '/api/leaderboard?limit=1000' : `/api/leaderboard?scope=dept&dept=${dept}&limit=1000`).then(setRows);
  }, [scope, dept]);

  const anyVotes = !!rows?.some((p) => p.wins + p.losses > 0);
  const list = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (s) return rows.filter((p) => `${p.name} ${p.department}`.toLowerCase().includes(s));
    return anyVotes ? rows.slice(3) : rows;
  }, [rows, q, anyVotes]);

  return (
    <div className="page">
      <div className="page-head"><span className="eyebrow">Hall of fame</span><h1 className="grad-text">Rankings</h1>
        <div className="tabs" role="tablist">
          {(['global', 'dept'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? 'sel' : ''} onClick={() => setScope(s)}>
              {scope === s && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring(1, 0.35)} />}
              {s === 'global' ? 'Global' : 'Department'}
            </button>
          ))}
        </div>
      </div>
      <div className="lb-tools">
        {scope === 'dept' && meta && (
          <select className="input" value={dept ?? ''} onChange={(e) => setDept(Number(e.target.value))} aria-label="Department" style={{ maxWidth: 340 }}>
            {meta.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <input className="input" type="search" placeholder="Search a professor…" aria-label="Search professor" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows && !q && anyVotes && <Podium key={`${scope}-${dept}`} top={rows} />}
      <div className="glass lb">
        {!rows ? <div className="loading" style={{ minHeight: 200 }}><div className="loader" />Counting trophies</div> : <>
          {!anyVotes && !q && <div className="empty">No battles yet — everyone starts at 1200 🏆. <Link href="/battle">Fight the first one!</Link></div>}
          {list.length === 0 && q && <div className="empty">No professors found.</div>}
          <AnimatePresence initial={false}>
            {list.slice(0, 300).map((p, i) => (
              <motion.button type="button" key={`${scope}-${dept}-${p.id}`} className="lb-row" onClick={() => open(p.id)} layout="position"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring(1, 0.35), delay: Math.min(i, 15) * 0.025 }}
                style={{ ['--rc' as any]: `var(--r-${p.league})` }}>
                <span className="rk">{p.rank}</span><Portrait p={p} />
                <span className="who"><b>{p.name}</b><small>{p.department || p.relationship}</small></span>
                <LeagueBadge league={p.league} />
                <span className="score"><Trophies n={p.elo} /><small>{p.wins}W · {p.losses}L</small></span>
              </motion.button>
            ))}
          </AnimatePresence>
        </>}
      </div>
    </div>
  );
}
