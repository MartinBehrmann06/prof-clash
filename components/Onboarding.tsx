'use client';
// First-login tour. A demo duel (watch, then try one), then a hands-on Weekend League: earn troops,
// send them to a building, fight the Sunday battle. Everything here is pretend: nothing is sent or stored
// except a "seen" flag per ETH username (on the server, cached locally). It can be replayed from the profile page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { DEPARTMENTS, deptById, type DeptStyle } from '@/lib/departments';
import { ethUser, league, ROUND_SIZE } from '@/lib/game';
import { DAILY_CAP, DEFENSE_BONUS, NEUTRAL_GARRISON, SEASON_WEEKS, WEEKEND_MULT } from '@/lib/conquest';
import { DuelCard, type DuelProf, type Phase } from './DuelCard';
import { Icon } from './art';
import { useGo } from './CloudTransition';

const seenKey = (user: string) => `prof-clash:onboarded:${user}`;
const REPLAY = 'prof-clash:onboarding';
const hasSeen = (user: string) => { try { return localStorage.getItem(seenKey(user)) === '1'; } catch { return true; } }; // no storage: don't nag
const markSeen = (user: string) => { try { localStorage.setItem(seenKey(user), '1'); } catch {} };
/** Tell the server, so the tour doesn't come back on another device or after the browser storage is cleared */
const markSeenOnServer = () => api('/api/me/onboarded', { method: 'POST' }).catch(() => {});

/** Opens the tour again (profile page) */
export const replayOnboarding = () => dispatchEvent(new Event(REPLAY));

const STEPS = ['welcome', 'watch', 'try', 'troops', 'map', 'battle', 'done'] as const;
type Step = (typeof STEPS)[number];

/** Shown once per ETH username after the first login, on any page but the login itself */
export function Onboarding() {
  const { ready, user, onboarded, setOnboarded } = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const name = user ? ethUser(user.email) : null;

  useEffect(() => {
    if (!ready || !name || onboarded || path === '/login') return;
    setOnboarded(true);
    markSeenOnServer();
    // seen on this browser before the server kept track: just record it there
    if (hasSeen(name)) return;
    // counts as seen as soon as it opens, so closing the tab halfway doesn't bring it back
    markSeen(name);
    setOpen(true);
  }, [ready, name, onboarded, path, setOnboarded]);
  useEffect(() => {
    const on = () => setOpen(true);
    addEventListener(REPLAY, on);
    return () => removeEventListener(REPLAY, on);
  }, []);
  const close = useCallback(() => { if (name) markSeen(name); setOpen(false); }, [name]);

  return <AnimatePresence>{open && <Tour key="tour" name={name ?? ''} onClose={close} />}</AnimatePresence>;
}

// ---------------------------------------------------------------------------------------------

/** Clearly fictional demo professors (figures are drawn from ids far outside the VVZ range) */
const demo = (id: number, name: string, department: string, lecture: string, semester: number, elo: number): DuelProf => ({
  id, name, fullName: name, relationship: 'Demo', department, field: '', image: null, url: '', elo, wins: 0, losses: 0, league: league(elo),
  lastLecture: { title: lecture, more: 0, semester, term: null },
});

function Tour({ name, onClose }: { name: string; onClose: () => void }) {
  const { profile } = useSession();
  const go = useGo();
  const [step, setStep] = useState<Step>('welcome');
  const [troops, setTroops] = useState(0);
  const [order, setOrder] = useState<{ code: string; n: number } | null>(null);
  const i = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(i + 1, STEPS.length - 1)]);
  const panel = useRef<HTMLDivElement>(null);

  const mine = profile ? deptById(profile.deptId) : DEPARTMENTS.find((d) => d.code === 'INFK')!;
  const rival = DEPARTMENTS.find((d) => d.id !== mine.id && d.code !== 'ETH')!;

  useEffect(() => { panel.current?.focus(); }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const finish = (href: string) => { onClose(); go(href); };

  return (
    <div className="modal-wrap onb-wrap">
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={MOTION.fade} />
      <motion.div ref={panel} tabIndex={-1} className="panel onb" role="dialog" aria-modal="true" aria-labelledby="onbTitle"
        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: MOTION.exit }} transition={MOTION.soft}>
        <div className="onb-top">
          <div className="onb-dots" aria-label={`Schritt ${i + 1} von ${STEPS.length}`}>
            {STEPS.map((s, k) => <i key={s} className={k < i ? 'done' : k === i ? 'on' : ''} />)}
          </div>
          {step !== 'done' && <button type="button" className="link" onClick={onClose}>Überspringen</button>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className="onb-body" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={MOTION.snappy}>
            {step === 'welcome' && <Welcome name={name} onNext={next} />}
            {step === 'watch' && <Watch dept={mine} onNext={next} />}
            {step === 'try' && <Try dept={mine} onNext={next} />}
            {step === 'troops' && <Troops troops={troops} setTroops={setTroops} onNext={next} />}
            {step === 'map' && <MiniMap mine={mine} rival={rival} troops={troops} order={order} setOrder={setOrder} onNext={next} />}
            {step === 'battle' && <Battle mine={mine} rival={rival} order={order} onNext={next} />}
            {step === 'done' && (
              <div className="onb-center">
                <span className="onb-icon"><Icon name="swords" size={34} /></span>
                <h2 id="onbTitle">Bereit für die Arena!</h2>
                <p>Duelle spielen, Ranking mitbestimmen, Truppen sammeln. Diese Tour findest du jederzeit wieder in deinem Profil.</p>
                <div className="actions">
                  <button className="btn gold" onClick={() => finish(profile ? '/battle' : '/setup')}>
                    <Icon name="play" size={18} /> {profile ? 'Erstes Duell starten' : 'Deck einrichten'}</button>
                  <button className="btn sm blue" onClick={() => finish('/departments')}>Zur Weekend League</button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Welcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <div className="onb-center">
      <span className="onb-icon"><Icon name="cap" size={34} /></span>
      <h2 id="onbTitle">Willkommen{name ? `, ${name}` : ''}!</h2>
      <p>In einer Minute zeigen wir dir, wie Prof Clash funktioniert:</p>
      <ul className="onb-list">
        <li><Icon name="swords" size={18} /> <span><b>Duelle:</b> zwei deiner Profs, du wählst, wessen Vorlesung du lieber besuchst.</span></li>
        <li><Icon name="trophy" size={18} /> <span><b>Runden:</b> {ROUND_SIZE} Duelle am Stück, danach siehst du deine Top 3.</span></li>
        <li><Icon name="shield" size={18} /> <span><b>Weekend League:</b> jedes Duell ist eine Truppe für dein Department.</span></li>
      </ul>
      <button className="btn gold" onClick={onNext}>Los geht&apos;s <Icon name="right" size={18} /></button>
    </div>
  );
}

/** The demo pair, laid out like the real duel */
function DemoDuel({ dept, phases, elo, onChoose, children }: {
  dept: DeptStyle; phases: [Phase, Phase]; elo: [number, number] | null; onChoose: (side: 0 | 1) => void; children?: React.ReactNode;
}) {
  const [a] = useState(() => demo(2_100_000_101, 'Prof. Beispiel', dept.name, 'Analysis II', 2, 1240));
  const [b] = useState(() => demo(2_100_000_202, 'Prof. Muster', DEPARTMENTS[(DEPARTMENTS.indexOf(dept) + 5) % DEPARTMENTS.length].name, 'Lineare Algebra', 1, 1210));
  const reveal = (k: 0 | 1, p: DuelProf) => (elo ? { from: p.elo, to: p.elo + (k === 0 ? elo[0] : elo[1]) } : null);
  return (
    <div className="duel onb-duel">
      <DuelCard prof={a} index={0} phase={phases[0]} elo={reveal(0, a)} onChoose={() => onChoose(0)} />
      <div className="vs" aria-hidden="true"><span className="vs-shield">VS</span></div>
      <DuelCard prof={b} index={1} phase={phases[1]} elo={reveal(1, b)} onChoose={() => onChoose(1)} />
      {children}
    </div>
  );
}

/** A pointer walks over and taps the left card, on a loop */
function Watch({ dept, onNext }: { dept: DeptStyle; onNext: () => void }) {
  const reduced = useReducedMotion();
  const [t, setT] = useState<'idle' | 'move' | 'tap'>('idle');
  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = () => {
      if (!alive) return;
      setT('idle');
      timers.push(setTimeout(() => alive && setT('move'), 900));
      timers.push(setTimeout(() => alive && setT('tap'), 1900));
      timers.push(setTimeout(loop, 4600));
    };
    loop();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);
  const chosen = t === 'tap';
  return (
    <>
      <h2 id="onbTitle">So läuft ein Duell</h2>
      <p className="onb-sub">Unter dem Namen steht die Vorlesung, die du <b>zuletzt</b> bei diesem Prof hattest. Tippe auf die Vorlesung, die du lieber besuchen würdest.</p>
      <DemoDuel dept={dept} phases={chosen ? ['chosen', 'other'] : ['idle', 'idle']} elo={chosen ? [14, -14] : null} onChoose={() => {}}>
        {!reduced && (
          <motion.span className="onb-hand" aria-hidden="true" initial={false}
            animate={t === 'idle' ? { left: '78%', top: '96%', scale: 1, opacity: 0.0 } : { left: '24%', top: '48%', scale: t === 'tap' ? 0.85 : 1, opacity: 1 }}
            transition={t === 'tap' ? { duration: 0.12 } : MOTION.soft}>
            <svg viewBox="0 0 40 48" width="44" height="52"><path d="M15 4c2.4 0 4 1.8 4 4.2V20l2-.4c2.2-.4 4 .8 4.6 2.6l3.6-.4c2.4-.2 4.4 1.4 4.6 3.8l.4 9.2C34.6 41 30 46 23.6 46h-3.4c-4 0-7.6-2.2-9.4-5.8l-6.4-12c-1-2 0-4.4 2.2-5 1.6-.4 3.2.2 4.2 1.6l.2.2V8.2C11 5.8 12.6 4 15 4Z" fill="#fff" stroke="#1e1712" strokeWidth="3" strokeLinejoin="round" /></svg>
          </motion.span>
        )}
      </DemoDuel>
      <p className="onb-sub small">{chosen ? 'Dein Favorit tritt vor und gewinnt Trophäen, erst jetzt siehst du die Zahl.' : 'Die Trophäen bleiben bis zur Wahl verdeckt, damit du nicht von der Masse beeinflusst wirst.'}</p>
      <button className="btn gold" onClick={onNext}>Jetzt du <Icon name="right" size={18} /></button>
    </>
  );
}

function Try({ dept, onNext }: { dept: DeptStyle; onNext: () => void }) {
  const [pick, setPick] = useState<0 | 1 | null>(null);
  const phases: [Phase, Phase] = pick === null ? ['idle', 'idle'] : pick === 0 ? ['chosen', 'other'] : ['other', 'chosen'];
  return (
    <>
      <h2 id="onbTitle">{pick === null ? 'Dein erstes Duell' : 'Genau so!'}</h2>
      <p className="onb-sub">{pick === null ? 'Wähle eine der beiden Demo-Vorlesungen. Das zählt noch nicht.' : `Ein echtes Duell zählt sofort fürs Ranking. Eine Runde hat ${ROUND_SIZE} Duelle, der Balken zeigt, wie weit du bist.`}</p>
      <DemoDuel dept={dept} phases={phases} elo={pick === null ? null : pick === 0 ? [16, -16] : [-12, 12]} onChoose={(s) => pick === null && setPick(s)} />
      {pick !== null && (
        <motion.div className="round onb-round" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.soft}>
          <div className="round-head"><span>Runde 1</span><b className="num">1<small>/{ROUND_SIZE}</small></b></div>
          <div className="round-bar" style={{ ['--n' as any]: ROUND_SIZE }}>{Array.from({ length: ROUND_SIZE }, (_, k) => <i key={k} className={k === 0 ? 'on' : ''} />)}</div>
        </motion.div>
      )}
      <button className="btn gold" onClick={onNext} disabled={pick === null}>Weiter zur Weekend League <Icon name="right" size={18} /></button>
    </>
  );
}

function Troops({ troops, setTroops, onNext }: { troops: number; setTroops: (n: number) => void; onNext: () => void }) {
  const need = NEED;
  return (
    <>
      <h2 id="onbTitle">Weekend League: Truppen sammeln</h2>
      <p className="onb-sub">Jedes Department ist ein Clan. <b>Jedes Duell bringt eine Truppe</b>, höchstens {DAILY_CAP} pro Tag, dazu jeder richtige Tipp des Tages. Am Wochenende zählt alles ×{WEEKEND_MULT}. Spiel ein paar Demo-Duelle:</p>
      <div className="onb-troops" aria-live="polite">
        <div className="onb-army">
          {Array.from({ length: 6 }, (_, k) => (
            <motion.span key={k} className={`trooper ${k < troops ? 'on' : ''}`} animate={k < troops ? { scale: [0.6, 1.15, 1], opacity: 1 } : { scale: 1, opacity: 0.35 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              <Icon name="shield" size={26} />
            </motion.span>
          ))}
        </div>
        <b className="num">{troops} {troops === 1 ? 'Truppe' : 'Truppen'}</b>
      </div>
      <div className="actions">
        <button className="btn sm stone" onClick={() => setTroops(Math.min(6, troops + 1))} disabled={troops >= 6}><Icon name="swords" size={16} /> Duell spielen (+1)</button>
        <button className="btn gold" onClick={onNext} disabled={troops < need}>{troops < need ? `Noch ${need - troops} Duell${need - troops === 1 ? '' : 'e'}` : <>Weiter <Icon name="right" size={18} /></>}</button>
      </div>
    </>
  );
}

/** The demo needs enough troops to beat the demo garrison */
const NEED = 3;
const DEMO_GARRISON = 2;

type Tile = { code: string; name: string; x: number; y: number; owner: 'mine' | 'rival' | null; home?: boolean };
const tiles = (): Tile[] => [
  { code: 'CAB', name: 'Dein Hauptquartier', x: 10, y: 10, owner: 'mine', home: true },
  { code: 'HG', name: 'Hauptgebäude', x: 210, y: 10, owner: null },
  { code: 'ML', name: 'Maschinenlabor', x: 10, y: 120, owner: 'rival' },
  { code: 'ETZ', name: 'Gloriastrasse 35', x: 210, y: 120, owner: 'rival', home: true },
];

function TileMap({ mine, rival, owner, sel, onSel, order }: {
  mine: DeptStyle; rival: DeptStyle; owner: (t: Tile) => Tile['owner']; sel?: string | null; onSel?: (t: Tile) => void; order: { code: string; n: number } | null;
}) {
  const color = (o: Tile['owner']) => (o === 'mine' ? mine.color : o === 'rival' ? rival.color : '#cbbd9f');
  return (
    <svg className="cq-map onb-map" viewBox="0 0 400 220" role="group" aria-label="Demo-Karte">
      {tiles().map((t) => {
        const on = sel === t.code, o = owner(t);
        return (
          <g key={t.code} className={`cq-tile ${on ? 'on' : ''}`} role="button" tabIndex={onSel ? 0 : -1} aria-pressed={on}
            aria-label={`${t.code}: ${t.home ? 'Hauptquartier' : o === null ? 'neutral' : o === 'mine' ? 'dein Clan' : `D-${rival.code}`}`}
            onClick={() => onSel?.(t)} onKeyDown={(e) => { if (onSel && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSel(t); } }}>
            {on && <rect x={t.x - 6} y={t.y - 6} width={192} height={102} rx="18" fill="var(--gold-1)" stroke="var(--ink)" strokeWidth="3" />}
            <motion.rect className="base" x={t.x} y={t.y} width={180} height={90} rx="14" initial={false} animate={{ fill: color(o) }} transition={{ duration: 0.5 }} />
            <text className="code" x={t.x + 90} y={t.y + 46}>{t.code}</text>
            <text className="own" x={t.x + 90} y={t.y + 74}>{o === 'mine' ? `D-${mine.code}` : o === 'rival' ? `D-${rival.code}` : 'Neutral'}</text>
            {t.home && <path transform={`translate(${t.x + 8} ${t.y + 6}) scale(1.1)`} d="M3.5 8 8 12l4-6.5 4 6.5 4.5-4-1.8 10.5H5.3L3.5 8Z" fill="var(--gold-1)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />}
            {order?.code === t.code && (
              <g className="ours"><rect x={t.x + 136} y={t.y - 12} width="52" height="28" rx="14" /><text x={t.x + 162} y={t.y + 8}>{order.n}</text></g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MiniMap({ mine, rival, troops, order, setOrder, onNext }: {
  mine: DeptStyle; rival: DeptStyle; troops: number; order: { code: string; n: number } | null; setOrder: (o: { code: string; n: number } | null) => void; onNext: () => void;
}) {
  const [sel, setSel] = useState<Tile | null>(null);
  const [n, setN] = useState(troops);
  const target = sel && !sel.home ? sel : null;
  return (
    <>
      <h2 id="onbTitle">Truppen einsetzen</h2>
      <p className="onb-sub">{order ? `${order.n} Truppen marschieren auf ${order.code}. Die anderen Clans sehen das nicht.`
        : 'Tippe auf ein neutrales Gebäude und schick deine Truppen hin. Eigene Gebäude verteidigst du genauso.'}</p>
      <TileMap mine={mine} rival={rival} owner={(t) => t.owner} sel={sel?.code} onSel={(t) => setSel(t)} order={order} />
      <div className="onb-detail" aria-live="polite">
        {!sel ? <small>Noch kein Gebäude gewählt.</small>
          : sel.home ? <small><b>{sel.code}</b> ist ein Hauptquartier und kann nicht erobert werden. Wähl ein anderes Gebäude.</small>
            : (
              <>
                <small><b>{sel.code}</b> · {sel.owner === null ? `Neutral, ${DEMO_GARRISON} Truppen Garnison (im echten Spiel ${NEUTRAL_GARRISON}).` : `Gehört D-${rival.code}. Verteidiger zählen ×${DEFENSE_BONUS}.`}</small>
                <div className="cq-step">
                  <button className="btn stone sm" onClick={() => setN(Math.max(0, n - 1))} disabled={n === 0}>−1</button>
                  <b className="num">{n}</b>
                  <button className="btn stone sm" onClick={() => setN(Math.min(troops, n + 1))} disabled={n >= troops}>+1</button>
                  <button className="btn sm red" onClick={() => target && setOrder({ code: target.code, n })} disabled={n === 0}><Icon name="swords" size={16} /> Angreifen</button>
                </div>
              </>
            )}
      </div>
      <button className="btn gold" onClick={onNext} disabled={!order}>Zur Schlacht <Icon name="right" size={18} /></button>
    </>
  );
}

function Battle({ mine, rival, order, onNext }: { mine: DeptStyle; rival: DeptStyle; order: { code: string; n: number } | null; onNext: () => void }) {
  const [fought, setFought] = useState(false);
  const t = tiles().find((x) => x.code === order?.code);
  const defence = t?.owner === 'rival' ? Math.round(DEMO_GARRISON * DEFENSE_BONUS * 10) / 10 : DEMO_GARRISON;
  const won = !!order && order.n > defence;
  return (
    <>
      <h2 id="onbTitle">{!fought ? 'Sonntag, 24:00: Schlacht!' : won ? `${order!.code} erobert!` : `${order!.code} hält stand`}</h2>
      <p className="onb-sub">{!fought
        ? 'Jeden Sonntag um Mitternacht wird überall gleichzeitig gekämpft. Wer mehr Truppen hat als die Verteidigung, erobert das Gebäude.'
        : won ? `${order!.n} gegen ${defence}: das Gebäude gehört jetzt D-${mine.code}. Am Montag deckt der Schlachtbericht alles auf.`
          : `${order!.n} gegen ${defence}: nicht genug. Nächste Woche mit mehr Truppen, oder zusammen mit deinem Clan.`}</p>
      <TileMap mine={mine} rival={rival} order={fought ? null : order}
        owner={(x) => (fought && won && x.code === order?.code ? 'mine' : x.owner)} />
      {fought && <p className="onb-sub small">Nach {SEASON_WEEKS} Wochen gewinnt der Clan mit den meisten Gebäuden. Nicht eingesetzte Truppen verfallen jeden Sonntag.</p>}
      {!fought
        ? <button className="btn red" onClick={() => setFought(true)}><Icon name="swords" size={18} /> Schlacht starten</button>
        : <button className="btn gold" onClick={onNext}>Verstanden <Icon name="right" size={18} /></button>}
    </>
  );
}
