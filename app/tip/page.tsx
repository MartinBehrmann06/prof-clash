'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameLink } from '@/components/CloudTransition';
import { DuelCard, type Phase } from '@/components/DuelCard';
import { Icon } from '@/components/art';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById } from '@/lib/departments';
import { QUESTIONS, TIP_CAP, TIP_POINTS, type TipAnswer, type TipGame, type TipMatchView, type TipReveal } from '@/lib/tip';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clan = (m: TipMatchView) => (m.oppDept ? `D-${deptById(m.oppDept).code}` : null);
const vs = (m: TipMatchView) => clan(m) ?? 'einen anderen Clan';

const STATUS: Record<TipMatchView['status'], string> = {
  playing: 'Läuft', waiting: 'Wartet auf Gegner', expired: 'Kein Gegner gekommen', won: 'Sieg', lost: 'Niederlage', draw: 'Unentschieden',
};

export default function TipPage() {
  const { ready, user, profile } = useSession();
  const [game, setGame] = useState<TipGame | null>(null);
  const [history, setHistory] = useState<TipMatchView[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(() => { api<TipMatchView[]>('/api/tip').then(setHistory).catch(() => setHistory([])); }, []);
  useEffect(() => { if (profile) loadHistory(); }, [profile, loadHistory]);

  const start = async () => {
    setBusy(true); setError('');
    try { setGame(await api<TipGame>('/api/tip', { method: 'POST', body: { action: 'start' } })); }
    catch (e: any) { setError(e?.message || 'Konnte kein Tipp-Duell starten'); }
    finally { setBusy(false); }
  };

  if (!ready) return <div className="loading"><span className="spin" />Lädt</div>;

  return (
    <div className="battle">
      <motion.header className="question" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
        <span className="mode"><Icon name="target" size={14} /> Tipp-Duell{game ? ` · gegen ${vs(game)}` : ''}</span>
        <h1>{game && game.status === 'playing' ? 'Wen hat die Mehrheit gewählt?' : 'Tipp-Duell: Was denkt die Mehrheit?'}</h1>
      </motion.header>

      {!user || !profile ? (
        <div className="panel cta-card" style={{ marginTop: 40 }}>
          <p>Im Tipp-Duell trittst du gegen Studierende aus anderen Clans an. Dafür brauchst du ein eingerichtetes ETH-Konto.</p>
          <GameLink className="btn sm gold" href={user ? '/setup' : '/login?next=setup'}>{user ? 'Einrichten' : 'ETH-Login'}</GameLink>
        </div>
      ) : game ? (
        <Play key={game.id} game={game} onDone={(m) => { setGame({ ...game, ...m }); loadHistory(); }} onAgain={() => { setGame(null); start(); }} />
      ) : (
        <>
          <div className="panel tip-intro">
            <ol>
              <li>Du siehst {QUESTIONS} Prof-Duelle und tippst jeweils, wen <b>die Mehrheit</b> der Studierenden gewählt hat.</li>
              <li>Ein Student aus einem anderen Clan bekommt <b>genau dieselben {QUESTIONS} Fragen</b>. Er muss nicht gleichzeitig online sein: Entweder hat er schon gespielt, oder er spielt sie später.</li>
              <li>Wer mehr richtig hat, gewinnt. Das Ergebnis siehst du hier, sobald beide fertig sind.</li>
              <li>Am Wochenende spielst du gegen den Gegner-Clan der Weekend League. Jeder Sieg zählt dann wie {TIP_POINTS} Duelle für deinen Clan (höchstens {TIP_CAP} Siege pro Person und Wochenende).</li>
            </ol>
            <button className="btn gold" onClick={start} disabled={busy}><Icon name="play" size={18} /> {busy ? 'Wird vorbereitet …' : 'Tipp-Duell starten'}</button>
            {error && <p className="tip-error">{error}</p>}
          </div>
          {history && history.length > 0 && (
            <section style={{ marginTop: 34 }}>
              <div className="head" style={{ marginBottom: 6 }}><h2 style={{ fontSize: 'clamp(24px, 3.4vw, 32px)' }}>Deine letzten Tipp-Duelle</h2></div>
              <div className="clan-grid">
                {history.map((m) => {
                  const d = m.oppDept ? deptById(m.oppDept) : null;
                  return (
                    <div key={m.id} className={`panel clan-row ${m.status === 'won' ? 'mine' : ''}`} style={{ ['--c' as any]: d?.color ?? '#b8bcc6' }}>
                      <span className="rk num" />
                      <span className="mini-shield">{d?.code ?? '?'}</span>
                      <span><b>{STATUS[m.status]}</b><small>gegen {vs(m)}{m.league ? ' · Weekend League' : ''}</small></span>
                      <span className="v num">{m.myScore ?? '–'}:{m.oppScore ?? '?'}<small>Richtige</small></span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      <p className="note">Die Antworten stammen aus den Abstimmungen aller Studierenden und werden beim Start des Duells festgehalten.</p>
    </div>
  );
}

/** One run through the questions: tip, see the crowd's answer, next */
function Play({ game, onDone, onAgain }: { game: TipGame; onDone: (m: TipMatchView) => void; onAgain: () => void }) {
  const [idx, setIdx] = useState(game.answered.length);
  const [pick, setPick] = useState<number | null>(null);
  const [res, setRes] = useState<TipReveal | null>(null);
  const [score, setScore] = useState(game.answered.filter((a) => a.correct).length);
  const [final, setFinal] = useState<TipMatchView | null>(game.status === 'playing' ? null : game);
  const lock = useRef(false);

  const choose = async (id: number) => {
    if (lock.current || final) return;
    lock.current = true;
    setPick(id);
    const t0 = performance.now();
    try {
      const r = await api<TipAnswer>('/api/tip', { method: 'POST', body: { action: 'tip', id: game.id, pick: id } });
      setRes(r);
      if (r.correct) setScore((s) => s + 1);
      await wait(Math.max(0, 1700 - (performance.now() - t0)));
      if (r.match.status !== 'playing') { setFinal(r.match); onDone(r.match); }
      else { setIdx((i) => i + 1); setPick(null); setRes(null); }
    } catch { setPick(null); }
    lock.current = false;
  };

  if (final) {
    const msg = final.status === 'waiting' ? `Dein Gegner aus ${clan(final) ?? 'einem anderen Clan'} spielt dieselben Fragen später. Du musst nicht online bleiben, das Ergebnis erscheint hier und auf der Clan-Seite.`
      : final.status === 'won' ? `Du hast ${clan(final) ?? 'deinen Gegner'} geschlagen!` : final.status === 'lost' ? `${clan(final) ?? 'Dein Gegner'} hatte diesmal mehr richtig.` : 'Gleich viele richtig, unentschieden.';
    return (
      <motion.div className="panel tip-result" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={MOTION.pop}>
        <span className="chip demo">{STATUS[final.status]}</span>
        <div className="tip-score num">{final.myScore}{final.oppScore !== null ? <>:{final.oppScore}</> : <small>/{QUESTIONS}</small>}</div>
        <p>{msg}{final.league && final.status === 'won' ? ` Der Sieg zählt wie ${TIP_POINTS} Duelle für deinen Clan.` : ''}</p>
        <div className="tip-actions">
          <button className="btn sm gold" onClick={onAgain}><Icon name="play" size={16} /> Nochmal</button>
          <GameLink className="btn sm stone" href="/departments">Zu den Clans</GameLink>
        </div>
      </motion.div>
    );
  }

  const q = game.questions[idx];
  const phase = (id: number): Phase => (pick === null ? 'idle' : pick === id ? 'chosen' : 'other');
  const name = (id: number) => (q.left.id === id ? q.left : q.right).name;
  return (
    <>
      <div className="duel">
        <AnimatePresence mode="wait">
          <DuelCard key={`l-${idx}`} index={0} prof={q.left} phase={phase(q.left.id)} elo={res ? { from: q.left.elo, to: q.left.elo } : null} eloNote="Elo" onChoose={() => choose(q.left.id)} />
        </AnimatePresence>
        <div className="vs" aria-hidden="true"><span className="vs-shield">VS</span></div>
        <AnimatePresence mode="wait">
          <DuelCard key={`r-${idx}`} index={1} prof={q.right} phase={phase(q.right.id)} elo={res ? { from: q.right.elo, to: q.right.elo } : null} eloNote="Elo" onChoose={() => choose(q.right.id)} />
        </AnimatePresence>
      </div>
      <div className="duel-bar">
        <span className="chip demo num">Frage {idx + 1}/{QUESTIONS} · {score} richtig</span>
        <span className="status" aria-live="polite">
          {res ? <b className={res.correct ? 'tip-ok' : 'tip-no'}>{res.correct ? 'Richtig!' : 'Daneben!'} {Math.round(res.share * 100)} % wählten {name(res.answer)}.</b>
            : pick ? 'Wird geprüft …' : 'Tippe auf die Karte, die die Mehrheit gewählt hat'}
        </span>
      </div>
    </>
  );
}
