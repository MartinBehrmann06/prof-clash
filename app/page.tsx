'use client';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { liveSource, practiceSource } from '@/lib/client/sources';
import { MOTION } from '@/lib/client/motion';
import { Duel } from '@/components/Duel';

export default function BattlePage() {
  const { ready, user, profile, setProfile } = useSession();
  const live = !!(user && profile);
  const source = useMemo(() => (live ? liveSource() : practiceSource()), [live]);
  const [empty, setEmpty] = useState(false);
  const onEmpty = useCallback(() => setEmpty(true), []);
  const onVoted = useCallback(() => {
    if (profile) setProfile({ ...profile, votes: profile.votes + 1, xp: profile.xp + 10 });
  }, [profile, setProfile]);

  if (!ready) return <div className="loading"><div className="spinner" />Lädt</div>;

  return (
    <div className="battle">
      <motion.header className="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
        <span className="eyebrow">{live ? `${profile!.programName} · Semester ${profile!.semester}` : 'Training · deine Wahl wird nicht gezählt'}</span>
        <h1 className="display">Wessen Vorlesung würdest du lieber besuchen?</h1>
      </motion.header>

      {empty ? (
        <div className="cta-card" style={{ marginTop: 40 }}>
          <p><b style={{ color: 'var(--ink)' }}>Alle Duelle entschieden.</b> Du hast jede Paarung deiner Professorenliste gewertet.</p>
          <Link className="btn sm" href="/rankings">Zu den Rankings</Link>
        </div>
      ) : (
        <Duel key={live ? 'live' : 'practice'} source={source} onVoted={live ? onVoted : undefined} onEmpty={onEmpty} />
      )}

      {!live && (
        <div className="cta-card">
          {!user
            ? <><p>Das ist ein Training mit echten Professoren — nichts wird gespeichert. Mit deiner ETH-Adresse zählt deine Stimme im Ranking.</p><Link className="btn sm" href="/login?next=setup">Mit ETH-Mail anmelden</Link></>
            : <><p>Wähle Studiengang und Semester, damit du über deine eigenen Professoren abstimmen kannst.</p><Link className="btn sm" href="/setup">Professorenliste einrichten</Link></>}
        </div>
      )}
      <p className="foot-note">Unabhängiges Studierendenprojekt, nicht offiziell von der ETH Zürich. Daten aus dem Vorlesungsverzeichnis.</p>
    </div>
  );
}
