'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { confetti, useToast } from '@/lib/client/feedback';
import { spring } from '@/lib/client/motion';
import { currentTerm, isAutumn, termLabel } from '@/lib/terms';
import { DeptEmblem, Portrait } from '@/components/art';
import type { Department, Meta, Profile, Roster } from '@/lib/types';

type Step = 1 | 2 | 3;
const STEPS: [string, string][] = [['🛡️', 'Clan'], ['📅', 'Semester'], ['⚔️', 'Roster']];

export default function SetupPage() {
  const router = useRouter();
  const { ready, user, profile, setProfile } = useSession();
  const toast = useToast();
  const locked = !!profile; // the clan is chosen once, then locked
  const [meta, setMeta] = useState<Meta | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [programId, setProgramId] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (ready && !user) router.replace('/login?next=setup'); }, [ready, user, router]);
  useEffect(() => { api<Meta>('/api/meta').then(setMeta); }, []);
  useEffect(() => {
    if (!profile) return;
    setDeptId(profile.deptId); setProgramId(profile.programId); setSemester(profile.semester); setStep(2);
  }, [profile]);

  const dept = meta?.depts.find((d) => d.id === deptId) ?? null;
  const go = (s: Step) => { setDir(s >= step ? 1 : -1); setStep(s); window.scrollTo({ top: 0 }); };

  if (!meta || !ready || !user) return <div className="loading"><div className="loader" />Loading</div>;

  return (
    <div className="page">
      <Stepper step={step} locked={locked} onGo={go} />
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir} variants={{ enter: (d: number) => ({ opacity: 0, x: 60 * d }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: -60 * d }) }}
          initial="enter" animate="center" exit="exit" transition={spring(1, 0.3)}>
          {step === 1 && <ClanStep meta={meta} deptId={deptId} programId={programId}
            onDept={(d) => { setDeptId(d.id); setProgramId(d.programs.length === 1 ? d.programs[0].id : null); }}
            onProgram={setProgramId} onNext={() => go(2)} />}
          {step === 2 && dept && <SemesterStep dept={dept} programId={programId!} semester={semester} minSemester={profile?.semester ?? 1} locked={locked}
            onPick={setSemester} onBack={() => go(1)} onNext={() => go(3)} />}
          {step === 3 && dept && programId && semester && (
            <RosterStep dept={dept} programId={programId} semester={semester} profile={profile} locked={locked}
              onBack={() => go(2)}
              onSave={async (profIds) => {
                if (!locked) { setConfirming(true); return; }
                await save(profIds);
              }}
              confirming={confirming} onCancelConfirm={() => setConfirming(false)}
              onConfirmed={async (profIds) => { setConfirming(false); await save(profIds); }} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  async function save(profIds: number[]) {
    try {
      const p = await api<Profile>('/api/profile', { method: 'POST', body: { programId, semester, profIds } });
      setProfile(p);
      if (!locked) { toast(`🛡️ Welcome to clan ${dept?.name}!`); confetti(innerWidth / 2, innerHeight / 3, 50); }
      else toast('Roster saved ✔');
      router.push('/battle');
    } catch (e: any) { toast(e.message, 'err'); }
  }
}

function Stepper({ step, locked, onGo }: { step: Step; locked: boolean; onGo: (s: Step) => void }) {
  return (
    <ol className="stepper" aria-label="Setup steps">
      {STEPS.map(([ico, label], i) => {
        const n = (i + 1) as Step, st = n < step ? 'done' : n === step ? 'now' : 'todo';
        const canGo = n < step && !(locked && n === 1);
        return (
          <li key={n} className={st}>
            {i > 0 && <span className="rail"><motion.i initial={false} animate={{ width: n <= step ? '100%' : '0%' }} transition={spring(1, 0.5)} /></span>}
            <button type="button" disabled={!canGo} onClick={() => onGo(n)} aria-current={st === 'now' ? 'step' : undefined}>
              <motion.span className="node" animate={{ scale: st === 'now' ? 1.12 : 1 }} transition={spring(0.6, 0.35)}>{n === 1 && locked ? '🔒' : st === 'done' ? '✓' : ico}</motion.span>
              <span className="lbl">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ClanBanner({ dept, programId, locked }: { dept: Department; programId: number; locked: boolean }) {
  return (
    <div className="glass clan-card"><DeptEmblem id={dept.id} />
      <div><span className="k">Your clan{locked ? ' · 🔒 locked' : ''}</span><b>{dept.name}</b>
        <small>{dept.programs.find((p) => p.id === programId)?.name} Bachelor</small></div>
    </div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const pop = { hidden: { opacity: 0, y: 16, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, bounce: 0.3, visualDuration: 0.4 } } };

function ClanStep({ meta, deptId, programId, onDept, onProgram, onNext }: {
  meta: Meta; deptId: number | null; programId: number | null;
  onDept: (d: Department) => void; onProgram: (id: number) => void; onNext: () => void;
}) {
  const dept = meta.depts.find((d) => d.id === deptId);
  return (
    <>
      <div className="page-head"><span className="eyebrow">Step 1 · Clan</span><h1>Choose your clan</h1>
        <p>Your department decides who you can battle — and which ladder your votes shape. <b>You choose once.</b></p></div>
      <motion.div className="dept-grid" variants={stagger} initial="hidden" animate="show">
        {meta.depts.map((d) => (
          <motion.button type="button" variants={pop} key={d.id} className={`dept ${d.id === deptId ? 'sel' : ''}`} onClick={() => onDept(d)}>
            <DeptEmblem id={d.id} /><b>{d.name}</b><small>{d.programs.length} programme{d.programs.length > 1 ? 's' : ''}</small>
          </motion.button>
        ))}
      </motion.div>
      <AnimatePresence>
        {dept && dept.programs.length > 1 && (
          <motion.div key={dept.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring(1, 0.35)} style={{ overflow: 'hidden' }}>
            <h3 className="sub-head">Which programme?</h3>
            <div className="prog-grid">
              {dept.programs.map((p) => (
                <button type="button" key={p.id} className={`prog ${p.id === programId ? 'sel' : ''}`} onClick={() => onProgram(p.id)}>
                  <b>{p.name}</b><small>{p.profs} professors</small></button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="step-actions"><button className="gbtn xl" disabled={!programId} onClick={onNext}>Next ➜</button></div>
    </>
  );
}

function SemesterStep({ dept, programId, semester, minSemester, locked, onPick, onBack, onNext }: {
  dept: Department; programId: number; semester: number | null; minSemester: number; locked: boolean;
  onPick: (n: number) => void; onBack: () => void; onNext: () => void;
}) {
  const autumn = isAutumn(currentTerm());
  return (
    <>
      <ClanBanner dept={dept} programId={programId} locked={locked} />
      <div className="page-head"><span className="eyebrow">Step 2 · Level</span><h1>Which semester are you in?</h1>
        <p>It’s {autumn ? 'autumn (HS)' : 'spring (FS)'} — most players are in semester {autumn ? '1, 3 or 5' : '2, 4 or 6'}.
          We look up who taught each semester back when <b>you</b> took it.</p></div>
      <motion.div className="levels" variants={stagger} initial="hidden" animate="show">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <motion.button type="button" variants={pop} key={n} className={`lvl ${n === semester ? 'sel' : ''} ${(n % 2 === 1) === autumn ? 'now' : ''}`}
            disabled={locked && n < minSemester} title={locked && n < minSemester ? 'Your semester can only go up' : undefined} onClick={() => onPick(n)}
            whileHover={{ y: -4 }} transition={spring(0.8, 0.3)}>
            <span className="n">{n}{n === 6 ? '+' : ''}</span><small>{n % 2 ? 'HS' : 'FS'} · Year {Math.ceil(n / 2)}</small>
          </motion.button>
        ))}
      </motion.div>
      <div className="step-actions">
        {!locked && <button className="gbtn ghost" onClick={onBack}>⬅ Back</button>}
        <button className="gbtn xl" disabled={!semester} onClick={onNext}>Next ➜</button>
      </div>
    </>
  );
}

function RosterStep({ dept, programId, semester, profile, locked, onBack, onSave, confirming, onCancelConfirm, onConfirmed }: {
  dept: Department; programId: number; semester: number; profile: Profile | null; locked: boolean;
  onBack: () => void; onSave: (ids: number[]) => void; confirming: boolean; onCancelConfirm: () => void; onConfirmed: (ids: number[]) => void;
}) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    setRoster(null);
    api<Roster>(`/api/roster?program=${programId}&semester=${semester}`).then((r) => {
      setRoster(r);
      const had = r.groups.filter((g) => g.status === 'had').flatMap((g) => g.entries.map((e) => e.prof.id));
      const allowed = new Set(r.groups.filter((g) => g.status !== 'future').flatMap((g) => g.entries.map((e) => e.prof.id)));
      // everyone you had is in; previously chosen extras (e.g. "semester unknown") stay picked
      setSelected(new Set([...had, ...(profile?.profIds ?? []).filter((id) => allowed.has(id))]));
    }).catch((e) => setError(e.message));
  }, [programId, semester]); // eslint-disable-line react-hooks/exhaustive-deps

  const previous = useMemo(() => new Set(profile?.profIds ?? []), [profile]);
  const allowed = useMemo(() => new Set(roster?.groups.filter((g) => g.status !== 'future').flatMap((g) => g.entries.map((e) => e.prof.id)) ?? []), [roster]);
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (error) return <div className="glass pad empty">{error}</div>;
  if (!roster) return <div className="loading"><div className="loader" />Drafting your deck</div>;

  return (
    <>
      <ClanBanner dept={dept} programId={programId} locked={locked} />
      <div className="page-head"><span className="eyebrow">Step 3 · Deck</span><h1>Your deck</h1>
        <p>Everyone who taught you up to semester {semester}, from the VVZ of the term you took each course. <b>Tap to remove</b> anyone you skipped.</p></div>
      <div className="glass pad">
        {roster.groups.map((g) => {
          const future = g.status === 'future';
          const title = g.semester ? `${future ? '🔒 ' : ''}Semester ${g.semester}` : 'Other mandatory courses';
          const pill = g.status === 'unknown' ? 'semester not in the VVZ — tap the ones you had'
            : future ? 'unlocks when you get there'
            : `${g.term ? termLabel(g.term) : ''} · ${g.entries.length} professor${g.entries.length > 1 ? 's' : ''}`;
          return (
            <div key={`${g.semester}-${g.status}`} className={`roster-group ${future ? 'future' : ''}`}>
              <h3>{title} <span className="chip">{pill}</span></h3>
              {g.fallbackTerm && !future && <p className="term-note">No VVZ data for {termLabel(g.term!)} yet — showing lecturers from {termLabel(g.fallbackTerm)}.</p>}
              <motion.div className="pick-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -60px 0px' }}>
                {g.entries.map(({ prof, courses }) => {
                  const sel = selected.has(prof.id);
                  // in a locked future semester, someone you already had stays shown as picked
                  const alreadyHad = future && allowed.has(prof.id);
                  return (
                    <motion.button type="button" variants={pop} key={prof.id} disabled={future}
                      className={`pick ${sel ? 'sel' : ''} ${future && !alreadyHad ? 'future' : ''} ${alreadyHad ? 'echo' : ''}`}
                      role="checkbox" aria-checked={sel} onClick={() => toggle(prof.id)} whileTap={!future ? { scale: 0.95 } : undefined}
                      title={alreadyHad ? 'Already in your deck from an earlier semester' : undefined}>
                      <AnimatePresence>{sel && <motion.span className="tick" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring(0.6, 0.3)}>✓</motion.span>}</AnimatePresence>
                      {locked && g.status === 'had' && !previous.has(prof.id) && <span className="new">NEW</span>}
                      <Portrait p={prof} />
                      <span className="meta"><b>{prof.name}</b><small>{courses.slice(0, 2).join(' · ')}</small></span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          );
        })}
      </div>
      <motion.div className="dock" initial={{ y: 120 }} animate={{ y: 0 }} transition={spring(0.8, 0.45)} style={{ x: '-50%' }}>
        <button className="gbtn ghost sm" onClick={onBack}>⬅</button>
        <span className="count"><motion.span key={selected.size} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={spring(0.6, 0.3)} style={{ display: 'inline-block' }}>{selected.size}</motion.span><small>cards in deck</small></span>
        <button className="gbtn" disabled={selected.size < 2} onClick={() => onSave([...selected])}>⚔ Battle</button>
      </motion.div>
      <AnimatePresence>
        {confirming && <LockDialog dept={dept} programId={programId} onCancel={onCancelConfirm} onConfirm={() => onConfirmed([...selected])} />}
      </AnimatePresence>
    </>
  );
}

/** The one irreversible step gets one honest confirmation */
function LockDialog({ dept, programId, onCancel, onConfirm }: { dept: Department; programId: number; onCancel: () => void; onConfirm: () => void }) {
  const [sealing, setSealing] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-wrap">
      <motion.div className="scrim" onClick={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="glass modal" role="alertdialog" aria-modal="true" aria-labelledby="lockTitle"
        initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(6px)' }} transition={spring(0.85, 0.4)}>
        <DeptEmblem id={dept.id} />
        <h2 id="lockTitle">Join clan {dept.name}?</h2>
        <p>Programme: <b style={{ color: 'var(--text)' }}>{dept.programs.find((p) => p.id === programId)?.name}</b>. Your clan <b style={{ color: 'var(--text)' }}>can’t be changed later</b> — that keeps every ladder fair.
          You can still level up your semester and edit your deck.</p>
        <div className="step-actions">
          <button className="gbtn ghost" onClick={onCancel} disabled={sealing}>Go back</button>
          <button className="gbtn gold" autoFocus disabled={sealing} onClick={() => { setSealing(true); setTimeout(onConfirm, 650); }}>🔒 Lock in</button>
        </div>
        <AnimatePresence>
          {sealing && <motion.div className="seal" initial={{ scale: 3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5, visualDuration: 0.4 }}>🔒</motion.div>}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
