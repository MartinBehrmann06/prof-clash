'use client';
import { GameLink } from '@/components/CloudTransition';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { liveSource, practiceSource } from '@/lib/client/sources';
import { MOTION } from '@/lib/client/motion';
import { Duel } from '@/components/Duel';
import { Figure } from '@/components/Figure';
import { Icon } from '@/components/art';
import { ShareButton } from '@/components/Share';
import { DailyGuess } from '@/components/DailyGuess';
import { currentTerm, shiftTerm, termLabel } from '@/lib/terms';
import { levelFor, ROUND_SIZE, roundOf } from '@/lib/game';
import type { MyStats } from '@/lib/types';

export default function BattlePage() {
  const { ready, user, profile, setProfile } = useSession();
  const live = !!(user && profile);
  const source = useMemo(() => (live ? liveSource() : practiceSource()), [live]);
  const [empty, setEmpty] = useState(false);
  const onEmpty = useCallback(() => setEmpty(true), []);

  // Rounds of ROUND_SIZE duels. The round starts where this visit found the vote count, rounded down,
  // so a reload mid-round keeps its place; the break screen ends it and "next round" starts a new one.
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => { if (profile && start === null) setStart(Math.floor(profile.votes / ROUND_SIZE) * ROUND_SIZE); }, [profile, start]);
  const [paused, setPaused] = useState(false);
  /** the Tipp des Tages in place of the duel, opened from the header */
  const [tips, setTips] = useState(false);
  const votes = useRef(0);
  votes.current = profile?.votes ?? 0;
  const round = profile && start !== null ? roundOf(profile.votes, profile.totalPairs, start) : null;
  const roundEnd = useRef(Infinity);
  roundEnd.current = round ? start! + round.size : Infinity;

  const onVoted = useCallback(() => {
    if (profile) setProfile({ ...profile, votes: profile.votes + 1, xp: profile.xp + 10, level: levelFor(profile.xp + 10) });
  }, [profile, setProfile]);
  // checked after the reveal of each vote: the last duel of a round still gets its full animation
  const canContinue = useCallback(() => votes.current < roundEnd.current, []);
  const onPause = useCallback(() => setPaused(true), []);
  const nextRound = () => { setStart(votes.current); setPaused(false); };

  if (!ready || (live && !round)) return <div className="loading"><span className="spin" />Lädt</div>;
  const allDone = empty || (live && profile!.votes >= profile!.totalPairs && paused);

  return (
    <div className="battle">
      <motion.header className="question" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
        <span className="mode">{live ? <><Icon name="shield" size={14} /> {profile!.programName} · Semester {profile!.semester}</> : <><Icon name="target" size={14} /> Training · deine Wahl wird nicht gezählt</>}</span>
        <h1>Wessen Vorlesung würdest du lieber besuchen?</h1>
        {live && round && round.size > 0 && !allDone && !tips && <RoundProgress number={round.number} done={round.done} size={round.size} />}
        {live && !allDone && !paused && (
          <button className="btn sm stone guess-toggle" onClick={() => setTips(!tips)}>
            {tips ? <><Icon name="swords" size={16} /> Zurück zu den Duellen</> : <><Icon name="target" size={16} /> Tipp des Tages</>}</button>
        )}
      </motion.header>

      {allDone ? (
        <motion.div className="panel done-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
          <h2>Alle Duelle geschafft!</h2>
          <p>Du hast alle Duelle für dieses Semester entschieden. Im {termLabel(shiftTerm(currentTerm(), 1))} startet eine neue Runde. Truppen holst du bis dahin mit dem Tipp des Tages.</p>
          <div className="actions">
            <GameLink className="btn sm gold" href="/departments">Weekend League</GameLink>
            <GameLink className="btn sm blue" href="/me">Dein Ranking</GameLink>
          </div>
          <GameLink className="link-quiet" href="/setup">Profs fehlen? Deck bearbeiten</GameLink>
          <ShareButton className="link-quiet share" path="/" text="Wessen Vorlesung würdest du lieber besuchen? Stimm ab auf Prof Clash." label="Prof Clash teilen" />
        </motion.div>
      ) : live && paused ? (
        <RoundBreak number={round!.number} played={round!.done} left={profile!.totalPairs - profile!.votes} onNext={nextRound} />
      ) : live && tips ? null : (
        <Duel key={live ? `live-${start}` : 'practice'} source={source} onVoted={live ? onVoted : undefined} onEmpty={onEmpty}
          canContinue={live ? canContinue : undefined} onPause={onPause} />
      )}

      {live && (allDone || paused || tips) && <DailyGuess />}

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

/** "Duell 7 von 20" with one segment per duel, so the end of the round is always in sight */
function RoundProgress({ number, done, size }: { number: number; done: number; size: number }) {
  return (
    <div className="round" role="progressbar" aria-valuemin={0} aria-valuemax={size} aria-valuenow={done} aria-label={`Runde ${number}: ${done} von ${size} Duellen`}>
      <div className="round-head">
        <span>Runde {number}</span>
        <b className="num">{Math.min(done + 1, size)}<small>/{size}</small></b>
      </div>
      <div className="round-bar" style={{ ['--n' as any]: size }}>
        {Array.from({ length: size }, (_, i) => <i key={i} className={i < done ? 'on' : i === done ? 'now' : ''} />)}
      </div>
    </div>
  );
}

/** End of a round: what it counted for, your current favourites, and the way on */
function RoundBreak({ number, played, left, onNext }: { number: number; played: number; left: number; onNext: () => void }) {
  const [stats, setStats] = useState<MyStats | null>(null);
  useEffect(() => { api<MyStats>('/api/me/stats').then(setStats).catch(() => {}); }, []);
  const top = stats?.ranking.slice(0, 3) ?? [];
  return (
    <motion.div className="panel done-card round-break" initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={MOTION.pop}>
      <span className="ribbon"><Icon name="trophy" size={14} /> Runde {number}</span>
      <h2>Runde geschafft!</h2>
      <p>{played} Duelle gewertet. Jedes zählt fürs Ranking und als Truppe für deinen Clan in der Weekend League.</p>
      {top.length > 0 && (
        <div className="podium-mini" aria-label="Deine Top 3 bisher">
          {top.map((p, i) => (
            <div key={p.id} className={`pm p${i + 1}`}>
              <span className="frame round"><Figure id={p.id} name={p.name} department={p.department} mood="happy" /></span>
              <b>{i + 1}. {p.name}</b>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        {left > 0 && <button className="btn sm gold" onClick={onNext}><Icon name="play" size={16} /> Nächste Runde ({Math.min(ROUND_SIZE, left)})</button>}
        <GameLink className="btn sm red" href="/departments">Truppen einsetzen</GameLink>
      </div>
      <GameLink className="link-quiet" href="/me">Dein ganzes Ranking ansehen</GameLink>
    </motion.div>
  );
}
