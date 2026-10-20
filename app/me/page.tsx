'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useSession } from '@/lib/client/session';
import { GameLink } from '@/components/CloudTransition';
import { useProfile } from '@/components/Profile';
import { Figure } from '@/components/Figure';
import { Icon } from '@/components/art';
import type { MyStats } from '@/lib/types';

/** Your own picks: how often you agree with the crowd, your favourites, and your boldest pick */
export default function MePage() {
  const router = useRouter();
  const { ready, user, profile } = useSession();
  const { open } = useProfile();
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login?next=setup');
    else if (!profile) router.replace('/setup');
  }, [ready, user, profile, router]);
  useEffect(() => { if (profile) api<MyStats>('/api/me/stats').then(setStats).catch(() => {}); }, [profile]);

  if (!profile || !stats) return <div className="loading"><span className="spin" />Lädt</div>;

  return (
    <div className="page me-page">
      <header className="head">
        <h1><span className="title-badge" style={{ ['--tb' as any]: 'var(--blue-2)' }}><Icon name="cap" /></span>Dein Profil</h1>
        <p>{profile.programName} · Semester {profile.semester}</p>
      </header>

      <section className="panel">
        <div className="stats" style={{ marginTop: 0 }}>
          <div className="stat"><b className="num">{profile.level}</b><small>Level</small></div>
          <div className="stat"><b className="num">{stats.votes}</b><small>Duelle gesamt</small></div>
          <div className="stat"><b className="num">{profile.votes}/{profile.totalPairs}</b><small>Diese Runde</small></div>
          <div className="stat"><b className="num">{stats.agree == null ? '–' : `${Math.round(stats.agree * 100)}%`}</b><small>Einig mit der Masse</small></div>
        </div>

        {stats.votes === 0 ? (
          <p className="me-empty">Noch keine Duelle. Sobald du abstimmst, siehst du hier deine Favoriten.</p>
        ) : <>
          <div className="list">
            <span className="h"><Icon name="crown" size={16} /> Deine Favoriten</span>
            {stats.favourites.map((p, i) => (
              <button key={p.id} type="button" className="fav" onClick={() => open(p)}>
                <span className="place num">{i + 1}</span>
                <span className="fig"><Figure id={p.id} name={p.name} department={p.department} mood="happy" /></span>
                <span className="who">{p.name}</span>
                <small>{p.wins} von {p.duels} gewonnen</small>
              </button>
            ))}
          </div>
          {stats.rebel && (
            <div className="list">
              <span className="h"><Icon name="target" size={16} /> Gegen den Strom</span>
              <p className="rebel">Du hast <b>{stats.rebel.winner.name}</b> vor <b>{stats.rebel.loser.name}</b> gewählt, obwohl {stats.rebel.loser.name} {stats.rebel.gap} Trophäen mehr hat.</p>
            </div>
          )}
        </>}

        <p className="me-actions">
          <GameLink className="btn sm gold" href="/battle">Weiter duellieren</GameLink>
          <GameLink className="btn sm blue" href="/setup">Deck bearbeiten</GameLink>
        </p>
      </section>
    </div>
  );
}
