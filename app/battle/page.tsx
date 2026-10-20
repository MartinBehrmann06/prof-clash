'use client';
import { GameLink } from '@/components/CloudTransition';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { liveSource, prefetchPractice, practiceSource } from '@/lib/client/sources';
import { MOTION } from '@/lib/client/motion';
import { Duel } from '@/components/Duel';
import { Icon } from '@/components/art';

export default function BattlePage() {
  const { ready, user, profile, setProfile } = useSession();
  const live = !!(user && profile);
  const source = useMemo(() => (live ? liveSource() : practiceSource()), [live]);
  const [empty, setEmpty] = useState(false);
  const onEmpty = useCallback(() => setEmpty(true), []);
  useEffect(prefetchPractice, []);
  const onVoted = useCallback(() => {
    if (profile) setProfile({ ...profile, votes: profile.votes + 1, xp: profile.xp + 10 });
  }, [profile, setProfile]);

  // while the session loads, the question and an empty duel already hold their place, so nothing jumps when the cards arrive
  if (!ready) return (
    <div className="battle">
      <header className="question"><span className="mode" style={{ visibility: 'hidden' }}>…</span><h1>Wessen Vorlesung würdest du lieber besuchen?</h1></header>
      <div className="loading duel-wait"><span className="spin" />Lädt</div>
    </div>
  );

  return (
    <div className="battle">
      <header className="question">
        <motion.span className="mode" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>{live ? <><Icon name="shield" size={14} /> {profile!.programName} · Semester {profile!.semester}</> : <><Icon name="target" size={14} /> Training · deine Wahl wird nicht gezählt</>}</motion.span>
        <h1>Wessen Vorlesung würdest du lieber besuchen?</h1>
      </header>

      {empty ? (
        <div className="panel cta-card" style={{ marginTop: 40 }}>
          <p><b>Alle Duelle entschieden!</b> Du hast jede Paarung deiner Professorenliste gewertet.</p>
          <GameLink className="btn sm gold" href="/rankings">Zu den Rankings</GameLink>
        </div>
      ) : (
        <Duel key={live ? 'live' : 'practice'} source={source} onVoted={live ? onVoted : undefined} onEmpty={onEmpty} />
      )}

      {!live && (
        <div className="panel cta-card">
          {!user
            ? <><p>Das ist ein <b>Training</b> mit echten Professoren — nichts wird gespeichert. Mit deiner ETH-Adresse zählt deine Stimme.</p><GameLink className="btn sm gold" href="/login?next=setup">ETH-Login</GameLink></>
            : <><p>Wähle Studiengang und Semester, damit du über deine eigenen Professoren abstimmst.</p><GameLink className="btn sm gold" href="/setup">Einrichten</GameLink></>}
        </div>
      )}
      <p className="note">Daten aus dem Vorlesungsverzeichnis der ETH; alle Figuren sind gezeichnet.</p>
    </div>
  );
}
