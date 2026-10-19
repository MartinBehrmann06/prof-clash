'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { currentTerm, isAutumn, termLabel } from '@/lib/terms';
import { deptById } from '@/lib/departments';
import { Figure } from '@/components/Figure';
import type { Department, Meta, Profile, Roster } from '@/lib/types';

type Step = 1 | 2 | 3;
const STEPS = ['🛡 Clan', '📅 Semester', '🃏 Deck'];

/**
 * Setup: department (chosen once, then locked) → semester → the professors you actually had,
 * looked up per semester in the VVZ of the term you took it.
 */
export default function SetupPage() {
  const router = useRouter();
  const { ready, user, profile, setProfile } = useSession();
  const toast = useToast();
  const locked = !!profile;
  const [meta, setMeta] = useState<Meta | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [programId, setProgramId] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number[] | null>(null);

  useEffect(() => { if (ready && !user) router.replace('/login?next=setup'); }, [ready, user, router]);
  useEffect(() => { api<Meta>('/api/meta').then(setMeta); }, []);
  useEffect(() => {
    if (!profile) return;
    setDeptId(profile.deptId); setProgramId(profile.programId); setSemester(profile.semester); setStep(2);
  }, [profile]);

  const dept = meta?.depts.find((d) => d.id === deptId) ?? null;
  const go = (s: Step) => { setDir(s >= step ? 1 : -1); setStep(s); window.scrollTo({ top: 0 }); };

  async function save(profIds: number[]) {
    try {
      const p = await api<Profile>('/api/profile', { method: 'POST', body: { programId, semester, profIds } });
      setProfile(p);
      toast(locked ? 'Deck gespeichert ✔' : `🛡 Willkommen im Clan D-${deptById(p.deptId).code}!`);
      router.push('/battle');
    } catch (e: any) { toast(e.message, 'err'); }
  }

  if (!meta || !ready || !user) return <div className="loading"><span className="spin">⚔️</span>Lädt</div>;

  return (
    <div className="page">
      <nav className="steps" aria-label="Schritte">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step, can = n < step && !(locked && n === 1);
          return (
            <button key={n} type="button" disabled={!can} onClick={() => go(n)} className={n === step ? 'on' : n < step ? 'done' : ''} aria-current={n === step ? 'step' : undefined}>
              <i>{n === 1 && locked ? '🔒' : n < step ? '✓' : n}</i>{label}
            </button>
          );
        })}
      </nav>
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir}
          variants={{ enter: (d: number) => ({ opacity: 0, x: 40 * d }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: -40 * d, transition: MOTION.exit }) }}
          initial="enter" animate="center" exit="exit" transition={MOTION.soft}>
          {step === 1 && <DeptStep meta={meta} deptId={deptId} programId={programId}
            onDept={(d) => { setDeptId(d.id); setProgramId(d.programs.length === 1 ? d.programs[0].id : null); }}
            onProgram={setProgramId} onNext={() => go(2)} />}
          {step === 2 && dept && <SemesterStep dept={dept} programId={programId!} semester={semester} min={profile?.semester ?? 1} locked={locked}
            onPick={setSemester} onBack={() => go(1)} onNext={() => go(3)} />}
          {step === 3 && dept && programId && semester && (
            <RosterStep dept={dept} programId={programId} semester={semester} profile={profile} locked={locked}
              onBack={() => go(2)} onSave={(ids) => (locked ? save(ids) : setConfirm(ids))} />
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {confirm && dept && <LockDialog dept={dept} programId={programId!} onCancel={() => setConfirm(null)} onConfirm={() => { const ids = confirm; setConfirm(null); save(ids); }} />}
      </AnimatePresence>
    </div>
  );
}

function DeptHeader({ dept, programId, locked }: { dept: Department; programId: number; locked: boolean }) {
  const d = deptById(dept.id);
  return (
    <div className="panel wood cta-card" style={{ margin: '0 auto 26px', ['--c' as any]: d.color }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="mini-shield">{d.code}</span>
        <span><b className="toon" style={{ display: 'block', fontSize: 20 }}>{dept.name}</b><small style={{ color: '#fff3d6' }}>{dept.programs.find((p) => p.id === programId)?.name} · Bachelor{locked ? ' · 🔒 festgelegt' : ''}</small></span>
      </span>
    </div>
  );
}

function DeptStep({ meta, deptId, programId, onDept, onProgram, onNext }: {
  meta: Meta; deptId: number | null; programId: number | null; onDept: (d: Department) => void; onProgram: (id: number) => void; onNext: () => void;
}) {
  const dept = meta.depts.find((d) => d.id === deptId);
  return (
    <>
      <header className="head"><h1>Wähle deinen Clan</h1>
        <p>Dein Department bestimmt, über wen du abstimmst und für welchen Clan deine Stimmen zählen. <b>Du wählst ihn einmal.</b></p></header>
      <div className="choice-grid">
        {meta.depts.map((d) => {
          const s = deptById(d.id);
          return (
            <button key={d.id} type="button" className={`choice ${d.id === deptId ? 'on' : ''}`} style={{ ['--c' as any]: s.color }} onClick={() => onDept(d)}>
              <span className="mini-shield" style={{ ['--c' as any]: s.color }}>{s.code}</span><span><b>{d.name}</b><small>{d.programs.length} Studiengang{d.programs.length > 1 ? 'e' : ''}</small></span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {dept && dept.programs.length > 1 && (
          <motion.div key={dept.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={MOTION.soft} style={{ overflow: 'hidden' }}>
            <h2 style={{ textAlign: 'center', margin: '30px 0 14px', fontSize: 28 }}>Studiengang</h2>
            <div className="choice-grid">
              {dept.programs.map((p) => (
                <button key={p.id} type="button" className={`choice ${p.id === programId ? 'on' : ''}`} style={{ ['--c' as any]: deptById(dept.id).color }} onClick={() => onProgram(p.id)}>
                  <span><b>{p.name}</b><small>{p.profs} Professor:innen</small></span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="duel-bar" style={{ marginTop: 28 }}><button className="btn xl" disabled={!programId} onClick={onNext}>Weiter ➜</button></div>
    </>
  );
}

function SemesterStep({ dept, programId, semester, min, locked, onPick, onBack, onNext }: {
  dept: Department; programId: number; semester: number | null; min: number; locked: boolean; onPick: (n: number) => void; onBack: () => void; onNext: () => void;
}) {
  const autumn = isAutumn(currentTerm());
  return (
    <>
      <DeptHeader dept={dept} programId={programId} locked={locked} />
      <header className="head"><h1>In welchem Semester bist du?</h1>
        <p>Für jedes Semester holen wir die Profs aus dem Semester, in dem du es wirklich besucht hast.</p></header>
      <div className="sems">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" className={`sem ${n === semester ? 'on' : ''} ${(n % 2 === 1) === autumn ? 'now' : ''}`}
            disabled={locked && n < min} title={locked && n < min ? 'Das Semester kann nur steigen' : undefined} onClick={() => onPick(n)}>
            <b>{n}{n === 6 ? '+' : ''}</b><small>{n % 2 ? 'HS' : 'FS'} · JAHR {Math.ceil(n / 2)}</small>
          </button>
        ))}
      </div>
      <div className="duel-bar" style={{ marginTop: 28 }}>
        {!locked && <button className="btn stone" onClick={onBack}>⬅ Zurück</button>}
        <button className="btn xl" disabled={!semester} onClick={onNext}>Weiter ➜</button>
      </div>
    </>
  );
}

function RosterStep({ dept, programId, semester, profile, locked, onBack, onSave }: {
  dept: Department; programId: number; semester: number; profile: Profile | null; locked: boolean; onBack: () => void; onSave: (ids: number[]) => void;
}) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    setRoster(null);
    api<Roster>(`/api/roster?program=${programId}&semester=${semester}`).then((r) => {
      setRoster(r);
      const had = r.groups.filter((g) => g.status === 'had').flatMap((g) => g.entries.map((e) => e.prof.id));
      const ok = new Set(r.groups.filter((g) => g.status !== 'future').flatMap((g) => g.entries.map((e) => e.prof.id)));
      setSelected(new Set([...had, ...(profile?.profIds ?? []).filter((id) => ok.has(id))]));
    }).catch((e) => setError(e.message));
  }, [programId, semester]); // eslint-disable-line react-hooks/exhaustive-deps

  const previous = useMemo(() => new Set(profile?.profIds ?? []), [profile]);
  const allowed = useMemo(() => new Set(roster?.groups.filter((g) => g.status !== 'future').flatMap((g) => g.entries.map((e) => e.prof.id)) ?? []), [roster]);
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (error) return <div className="empty">{error}</div>;
  if (!roster) return <div className="loading"><span className="spin">⚔️</span>Profs werden gerufen …</div>;

  return (
    <>
      <DeptHeader dept={dept} programId={programId} locked={locked} />
      <header className="head"><h1>Dein Deck</h1>
        <p>Alle Profs aus deinen Pflichtfächern bis Semester {semester}. Tippe auf eine Karte, um sie zu entfernen, falls du die Vorlesung nicht besucht hast.</p></header>
      <div className="panel" style={{ paddingTop: 10 }}>
      {roster.groups.map((g) => {
        const future = g.status === 'future';
        return (
          <section key={`${g.semester}-${g.status}`} className={`group ${future ? 'future' : ''}`}>
            <h3>{g.semester ? `Semester ${g.semester}` : 'Weitere Pflichtfächer'}
              <small>{g.status === 'unknown' ? 'Semester im VVZ nicht angegeben — wähle selbst' : future ? 'noch nicht besucht' : g.term ? termLabel(g.term) : ''}</small></h3>
            {g.fallbackTerm && !future && <p className="term-note">Für {termLabel(g.term!)} noch keine VVZ-Daten — Dozierende aus {termLabel(g.fallbackTerm)}.</p>}
            <div className="picks">
              {g.entries.map(({ prof, courses }) => {
                const on = selected.has(prof.id), echo = future && allowed.has(prof.id);
                return (
                  <motion.button key={prof.id} type="button" disabled={future} role="checkbox" aria-checked={on}
                    className={`pick ${on ? 'on' : ''} ${future && !echo ? 'future' : ''} ${echo ? 'echo' : ''}`}
                    whileTap={!future ? { scale: 0.96 } : undefined} transition={MOTION.press} onClick={() => toggle(prof.id)}>
                    <AnimatePresence>{on && <motion.span className="tick" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={MOTION.pop}>✓</motion.span>}</AnimatePresence>
                    {locked && g.status === 'had' && !previous.has(prof.id) && <span className="new">NEU</span>}
                    <span className="frame" style={{ display: 'block' }}><Figure id={prof.id} name={prof.name} department={prof.department} /></span>
                    <b>{prof.name}</b><small>{courses.slice(0, 2).join(' · ')}</small>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
      </div>
      <div style={{ height: 80 }} />
      <motion.div className="dock" initial={{ y: 100, x: '-50%' }} animate={{ y: 0, x: '-50%' }} transition={MOTION.soft}>
        <button className="btn sm stone" onClick={onBack} aria-label="Zurück">⬅</button>
        <span className="count"><span className="num">{selected.size}</span> Karten</span>
        <button className="btn" disabled={selected.size < 2} onClick={() => onSave([...selected])}>⚔️ Battle!</button>
      </motion.div>
    </>
  );
}

/** The one irreversible step gets one honest confirmation */
function LockDialog({ dept, programId, onCancel, onConfirm }: { dept: Department; programId: number; onCancel: () => void; onConfirm: () => void }) {
  const d = deptById(dept.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-wrap">
      <motion.div className="scrim" onClick={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={MOTION.fade} />
      <motion.div className="panel modal" role="alertdialog" aria-modal="true" aria-labelledby="lockTitle" style={{ ['--c' as any]: d.color }}
        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: MOTION.exit }} transition={MOTION.soft}>
        <span className="ribbon">🔒 Festlegen?</span>
        <span className="mini-shield" style={{ width: 70, height: 80, fontSize: 18 }}>{d.code}</span>
        <h2 id="lockTitle" style={{ fontSize: 28, color: 'var(--gold-1)' }}>Clan D-{d.code} beitreten?</h2>
        <p>{dept.programs.find((p) => p.id === programId)?.name}. Dein Department <b>lässt sich danach nicht mehr ändern</b> — so bleibt jede Department-Wertung fair. Semester und Professorenliste kannst du später anpassen.</p>
        <div className="duel-bar" style={{ marginTop: 6 }}>
          <button className="btn stone" onClick={onCancel}>Zurück</button>
          <button className="btn gold" autoFocus onClick={onConfirm}>🔒 Beitreten</button>
        </div>
      </motion.div>
    </div>
  );
}
