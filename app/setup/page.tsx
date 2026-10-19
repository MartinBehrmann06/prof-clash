'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { confetti, useToast } from '@/lib/client/feedback';
import { spring } from '@/lib/client/motion';
import { currentTerm, isAutumn, termLabel } from '@/lib/terms';
import { DeptCrest, Portrait } from '@/components/art';
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

  if (!meta || !ready || !user) return <div className="loading-crest"><span><span className="spin">⚔️</span><br />Loading…</span></div>;

  return (
    <div className="view setup-view">
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
          <li key={n} className={`step-node ${st}`}>
            {i > 0 && <span className="step-rope" />}
            <button type="button" disabled={!canGo} onClick={() => onGo(n)} aria-current={st === 'now' ? 'step' : undefined}>
              <span className="shield">{n === 1 && locked ? '🔒' : st === 'done' ? '✔' : ico}</span><span className="lbl">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ClanBanner({ dept, programId, locked }: { dept: Department; programId: number; locked: boolean }) {
  return (
    <div className="clan-banner panel wood nails"><DeptCrest id={dept.id} />
      <div><div className="cb-kicker">Your clan{locked ? ' · 🔒 locked' : ''}</div><div className="cb-name">{dept.name}</div>
        <div className="cb-prog">{dept.programs.find((p) => p.id === programId)?.name} Bachelor</div></div>
    </div>
  );
}

function ClanStep({ meta, deptId, programId, onDept, onProgram, onNext }: {
  meta: Meta; deptId: number | null; programId: number | null;
  onDept: (d: Department) => void; onProgram: (id: number) => void; onNext: () => void;
}) {
  const dept = meta.depts.find((d) => d.id === deptId);
  return (
    <>
      <div className="setup-head"><h1>Choose your clan</h1>
        <p>Your department decides which professors you can battle — and which ladder your votes shape. <b>You pick it once.</b></p></div>
      <div className="panel"><div className="panel-title stroke">Department</div>
        <div className="dept-grid">
          {meta.depts.map((d) => (
            <button type="button" key={d.id} className={`dept-tile ${d.id === deptId ? 'sel' : ''}`} onClick={() => onDept(d)}>
              <DeptCrest id={d.id} /><span className="dn">{d.name}</span><span className="dc">{d.programs.length} programme{d.programs.length > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
        {dept && dept.programs.length > 1 && <>
          <h3 className="sub-h">Which programme?</h3>
          <div className="prog-grid">
            {dept.programs.map((p) => (
              <button type="button" key={p.id} className={`prog-tile ${p.id === programId ? 'sel' : ''}`} onClick={() => onProgram(p.id)}>
                {p.name}<small>{p.profs} professors</small></button>
            ))}
          </div>
        </>}
      </div>
      <div className="step-actions"><button className="btn huge" disabled={!programId} onClick={onNext}>Next ➜</button></div>
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
      <div className="setup-head"><h1>Which semester are you in?</h1>
        <p>It’s {autumn ? 'autumn (HS)' : 'spring (FS)'} — most of you are in semester {autumn ? '1, 3 or 5' : '2, 4 or 6'}.
          We look up who taught each of your semesters back when <b>you</b> took them.</p></div>
      <div className="sem-board">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button type="button" key={n} className={`sem-plaque ${n === semester ? 'sel' : ''} ${(n % 2 === 1) === autumn ? 'now-term' : ''}`}
            disabled={locked && n < minSemester} title={locked && n < minSemester ? 'Your semester can only go up' : undefined} onClick={() => onPick(n)}>
            <span className="sn">{n}{n === 6 ? '+' : ''}</span><span className="st">{n % 2 ? 'HS' : 'FS'} · Year {Math.ceil(n / 2)}</span>
          </button>
        ))}
      </div>
      <div className="step-actions">
        {!locked && <button className="btn stone" onClick={onBack}>⬅ Back</button>}
        <button className="btn huge" disabled={!semester} onClick={onNext}>Next ➜</button>
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

  if (error) return <div className="panel done-panel"><p>{error}</p></div>;
  if (!roster) return <div className="loading-crest"><span><span className="spin">⚔️</span><br />Summoning your professors…</span></div>;

  return (
    <>
      <ClanBanner dept={dept} programId={programId} locked={locked} />
      <div className="setup-head"><h1>Your roster</h1>
        <p>Everyone who taught you up to semester {semester} — from the VVZ of the term you actually took each course. <b>Tap to remove</b> anyone you skipped.</p></div>
      <div className="panel roster">
        {roster.groups.map((g) => {
          const future = g.status === 'future';
          const title = g.semester ? `${future ? '🔒 ' : ''}Semester ${g.semester}` : 'Other mandatory courses';
          const pill = g.status === 'unknown' ? 'semester not listed in the VVZ — tap the ones you had'
            : future ? 'unlocks when you get there'
            : `${g.term ? termLabel(g.term) : ''} · ${g.entries.length} professor${g.entries.length > 1 ? 's' : ''}`;
          return (
            <div key={`${g.semester}-${g.status}`} className={`year-group ${future ? 'future-group' : ''}`}>
              <h3>{title} <span className="pill">{pill}</span></h3>
              {g.fallbackTerm && !future && <p className="term-note">No VVZ data for {termLabel(g.term!)} yet — showing lecturers from {termLabel(g.fallbackTerm)}.</p>}
              <div className="prof-grid">
                {g.entries.map(({ prof, courses }) => {
                  const sel = selected.has(prof.id);
                  // in a locked future semester, someone you already had stays shown as picked
                  const alreadyHad = future && allowed.has(prof.id);
                  return (
                    <button type="button" key={prof.id} className={`prof-pick ${sel ? 'sel' : ''} ${future && !alreadyHad ? 'future' : ''} ${alreadyHad ? 'echo' : ''}`}
                      disabled={future} role="checkbox" aria-checked={sel} onClick={() => toggle(prof.id)}
                      title={alreadyHad ? 'You already had this professor — picked in an earlier semester' : undefined}>
                      <span className="check">✔</span>
                      {locked && !future && g.status === 'had' && !previous.has(prof.id) && <span className="new-badge">NEW</span>}
                      <Portrait p={prof} /><span className="nm">{prof.name}</span><span className="cs">{courses.slice(0, 2).join(' · ')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="dock">
        <button className="btn stone small" onClick={onBack}>⬅ Semester</button>
        <span className="count">{selected.size} selected</span>
        <button className="btn" disabled={selected.size < 2} onClick={() => onSave([...selected])}>⚔️ To battle!</button>
      </div>
      <AnimatePresence>
        {confirming && <LockDialog dept={dept} programId={programId} onCancel={onCancelConfirm} onConfirm={() => onConfirmed([...selected])} />}
      </AnimatePresence>
    </>
  );
}

/** The one irreversible step gets one honest confirmation */
function LockDialog({ dept, programId, onCancel, onConfirm }: { dept: Department; programId: number; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-wrap">
      <motion.div className="modal-scrim" onClick={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="panel modal" role="alertdialog" aria-modal="true" aria-labelledby="lockTitle"
        initial={{ opacity: 0, y: 30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={spring(0.85, 0.35)}>
        <div className="panel-title stroke">Lock in?</div>
        <DeptCrest id={dept.id} />
        <h2 id="lockTitle">Join clan {dept.name}?</h2>
        <p>Programme: <b>{dept.programs.find((p) => p.id === programId)?.name}</b>. Your clan <b>can’t be changed later</b> — that keeps every department’s ladder fair.
          You can still move up a semester and edit your roster.</p>
        <div className="step-actions">
          <button className="btn stone" onClick={onCancel}>Go back</button>
          <button className="btn" autoFocus onClick={onConfirm}>🔒 Lock in &amp; battle</button>
        </div>
      </motion.div>
    </div>
  );
}
