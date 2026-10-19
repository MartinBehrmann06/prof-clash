'use client';
import { GameLink } from '@/components/CloudTransition';
import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { liveSource, practiceSource } from '@/lib/client/sources';
import { MOTION } from '@/lib/client/motion';
import { Duel } from '@/components/Duel';
import { Icon } from '@/components/art';

export default function BattlePage() {
  const { ready, user, profile, setProfile } = useSession();
  const live = !!(user && profile);
  const source = useMemo(() => (live ? liveSource() : practiceSource()), [live]);
  const [empty, setEmpty] = useState(false);
  const onEmpty = useCallback(() => setEmpty(true), []);
  const onVoted = useCallback(() => {
    if (profile) setProfile({ ...profile, votes: profile.votes + 1, xp: profile.xp + 10 });
  }, [profile, setProfile]);

  if (!ready) return <div className="loading"><span className="spin" />Lädt</div>;

  return (
    <div className="battle">
      <motion.header className="question" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
        <span className="mode">{live ? <><Icon name="shield" size={14} /> {profile!.programName} · Semester {profile!.semester}</> : <><Icon name="target" size={14} /> Training · deine Wahl wird nicht gezählt</>}</span>
        <h1>Wessen Vorlesung würdest du lieber besuchen?</h1>
      </motion.header>

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
