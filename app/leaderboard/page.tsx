'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, useSession } from '@/lib/client/session';
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
  const title = scope === 'global' ? 'Global ladder' : meta?.depts.find((d) => d.id === dept)?.name ?? 'Department';

  return (
    <div className="view view-enter">
      <div className="lb-head"><h1>Hall of Trophies</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={scope === 'global'} className={scope === 'global' ? 'sel' : ''} onClick={() => setScope('global')}>🌍 Global</button>
          <button role="tab" aria-selected={scope === 'dept'} className={scope === 'dept' ? 'sel' : ''} onClick={() => setScope('dept')}>🛡️ Department</button>
        </div>
      </div>
      <div className="lb-tools">
        {scope === 'dept' && meta && (
          <select className="select" value={dept ?? ''} onChange={(e) => setDept(Number(e.target.value))} aria-label="Department">
            {meta.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <input className="search" type="search" placeholder="🔎 Search a professor…" aria-label="Search professor" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows && !q && anyVotes && <Podium top={rows} style={{ margin: '30px auto 10px' }} />}
      <div className="panel lb-list"><div className="panel-title stroke">{title}</div>
        {!rows ? <div className="empty">Counting trophies…</div> : <>
          {!anyVotes && !q && <div className="empty">No battles yet — everyone starts at 1200 🏆. <Link href="/battle">Fight the first one!</Link></div>}
          {list.length === 0 && q && <div className="empty">No professors found.</div>}
          {list.slice(0, 300).map((p) => (
            <button type="button" key={p.id} className="lb-row" onClick={() => open(p.id)}>
              <div className="rk">{p.rank}</div><Portrait p={p} />
              <div className="who"><b>{p.name}</b><small>{p.department || p.relationship}</small></div>
              <LeagueBadge league={p.league} />
              <div><Trophies n={p.elo} /><div className="wl">{p.wins}W · {p.losses}L</div></div>
            </button>
          ))}
        </>}
      </div>
    </div>
  );
}
