'use client';
// Tipp des Tages: GUESSES_PER_DAY quick guesses a day about which of two professors the crowd prefers.
// Each right guess is a troop for the Weekend League. It never runs out, unlike a student's own pairs.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import { Figure } from './Figure';
import { Icon } from './art';
import type { GuessDay, GuessProf, GuessResult } from '@/lib/types';

export function DailyGuess() {
  const [day, setDay] = useState<GuessDay | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  /** the question just guessed stays on screen until "next" */
  const [shown, setShown] = useState<number | null>(null);
  const [won, setWon] = useState(0);

  useEffect(() => { api<GuessDay>('/api/guess').then(setDay).catch(() => setFailed(true)); }, []);

  if (failed) return null;
  if (!day) return <section className="panel guess-card"><div className="loading"><span className="spin" />Tipps laden</div></section>;
  const qs = day.questions;
  if (!qs.length) return (
    <section className="panel guess-card">
      <h2><Icon name="target" size={20} /> Tipp des Tages</h2>
      <p className="muted">Noch zu wenig Stimmen für Tipps. Sobald mehr gespielt wurde, gibt es hier jeden Tag {day.perDay} neue.</p>
    </section>
  );

  const q = qs.find((x) => x.idx === shown) ?? qs.find((x) => x.picked === null);
  const right = qs.filter((x) => x.picked !== null && x.picked === x.answer).length;
  const answered = qs.filter((x) => x.picked !== null).length;

  const guess = async (pick: number) => {
    if (!q || busy || q.picked !== null) return;
    setBusy(true);
    try {
      const r = await api<GuessResult>('/api/guess', { method: 'POST', body: { idx: q.idx, pick } });
      setDay({ ...day, questions: qs.map((x) => (x.idx === q.idx ? { ...x, picked: pick, answer: r.answer } : x)) });
      setShown(q.idx);
      setWon((n) => n + r.troops);
    } catch {
      // the day changed or the question is gone: start over with today's
      api<GuessDay>('/api/guess').then((d) => { setDay(d); setShown(null); }).catch(() => setFailed(true));
    } finally { setBusy(false); }
  };

  return (
    <section className="panel guess-card" aria-live="polite">
      <div className="guess-head">
        <h2><Icon name="target" size={20} /> Tipp des Tages</h2>
        <span className="num">{Math.min(answered + (q && q.picked === null ? 1 : 0), qs.length)}<small>/{qs.length}</small></span>
      </div>
      {!q ? (
        <div className="guess-done">
          <b>{right} von {qs.length} richtig</b>
          <p className="muted">{won > 0 ? `+${won} Truppen für deinen Clan. ` : ''}Morgen gibt es neue Tipps.</p>
        </div>
      ) : (
        <>
          <p className="guess-q">Wen hat die Masse lieber?</p>
          <AnimatePresence mode="wait">
            <motion.div key={q.idx} className="guess-pair" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={MOTION.snappy}>
              {[q.left, q.right].map((p) => (
                <Pick key={p.id} prof={p} onPick={() => guess(p.id)} disabled={busy || q.picked !== null}
                  state={q.picked === null ? 'idle' : p.id === q.answer ? 'answer' : p.id === q.picked ? 'wrong' : 'other'} />
              ))}
            </motion.div>
          </AnimatePresence>
          {q.picked !== null && (
            <div className="guess-result">
              <b className={q.picked === q.answer ? 'yes' : 'no'}>{q.picked === q.answer ? `Richtig! +${day.troops} ${day.troops === 1 ? 'Truppe' : 'Truppen'}` : 'Daneben'}</b>
              <button className="btn sm blue" onClick={() => setShown(null)}>
                {qs.some((x) => x.picked === null) ? <>Nächster Tipp <Icon name="right" size={16} /></> : 'Fertig'}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Pick({ prof, state, disabled, onPick }: { prof: GuessProf; state: 'idle' | 'answer' | 'wrong' | 'other'; disabled: boolean; onPick: () => void }) {
  const dept = deptByName(prof.department);
  return (
    <button type="button" className={`guess-prof ${state}`} style={{ ['--accent' as any]: dept.color }} disabled={disabled} onClick={onPick} aria-label={`${prof.name} tippen`}>
      <span className="frame round"><Figure id={prof.id} name={prof.name} department={prof.department} mood={state === 'answer' ? 'happy' : state === 'idle' ? 'idle' : 'sad'} /></span>
      <b>{prof.name}</b>
      <small>{dept.code}{prof.field ? ` · ${prof.field}` : ''}</small>
      {state === 'answer' && <span className="tick"><Icon name="check" size={16} /></span>}
    </button>
  );
}
