'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { getSupabase, useSession } from '@/lib/client/session';
import { Icon } from '@/components/art';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { isEthEmail } from '@/lib/game';

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

const RESEND_AFTER = 90; // ETH mail filtering can take a minute or two
const LEN = 6;
const MIN_PW = 8;
/** pages a ?next= may lead back to; anything else (like //other.site) is ignored */
const NEXT = ['setup', 'me', 'battle', 'rankings', 'departments'];

type Step = 'login' | 'signup' | 'code' | 'newpw';
/** why a code was mailed: confirming a new account, or a forgotten / never-set password */
type CodeFor = 'signup' | 'reset';

const slide = (dir: number) => ({ initial: { opacity: 0, x: 30 * dir }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 * dir }, transition: MOTION.snappy });

function Login() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { user, profile, refresh } = useSession();
  const toast = useToast();
  const [step, setStep] = useState<Step>('login');
  const [codeFor, setCodeFor] = useState<CodeFor>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [scope, animate] = useAnimate();
  // a reset code signs the user in before they pick a new password, so hold the redirect until then
  const holdRedirect = useRef(false);
  // a returning player with a deck goes to the battle, not back through setup
  const leave = () => router.replace(next && NEXT.includes(next) && !(next === 'setup' && profile) ? `/${next}` : profile ? '/battle' : '/setup');

  useEffect(() => { if (user && !holdRedirect.current) leave(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const shake = () => animate(scope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4 });
  const fail = (m: string) => { setMsg(m); shake(); };
  const go = (s: Step) => { setStep(s); setMsg(''); };
  const mailError = (m: string) =>
    // the database rejects non-ETH signups; Supabase reports that as a generic "Database error"
    /database/i.test(m) ? 'Nur ETH-Adressen können sich anmelden.'
      : /rate|seconds/i.test(m) ? 'Zu viele E-Mails angefordert — bitte kurz warten.' : m;

  /** trimmed, lower-cased ETH address, or null after showing why not */
  function ethEmail() {
    const e = email.trim().toLowerCase();
    if (!isEthEmail(e)) { fail('Bitte eine ETH-Adresse verwenden, z. B. name@student.ethz.ch'); return null; }
    setEmail(e);
    return e;
  }

  function toCode(e: string, why: CodeFor) {
    setEmail(e); setCodeFor(why); setDigits(Array(LEN).fill('')); setCooldown(RESEND_AFTER); go('code');
  }

  async function logIn() {
    const e = ethEmail(); if (!e) return;
    if (!password) { fail('Bitte Passwort eingeben.'); return; }
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.signInWithPassword({ email: e, password });
    setBusy(false);
    if (!error) { toast('Willkommen zurück!'); await refresh(); return; }
    if (/not confirmed/i.test(error.message)) {
      // signed up but never entered the code: send a fresh one
      if (await mail(e, 'signup')) toast('Bestätige zuerst deine E-Mail — neuer Code gesendet');
      return;
    }
    fail(/invalid/i.test(error.message) ? 'E-Mail oder Passwort falsch. Noch kein Passwort? → „Passwort vergessen“.' : error.message);
  }

  async function signUp() {
    const e = ethEmail(); if (!e) return;
    if (password.length < MIN_PW) { fail(`Passwort muss mindestens ${MIN_PW} Zeichen haben.`); return; }
    setMsg(''); setBusy(true);
    const { data, error } = await (await getSupabase()).auth.signUp({ email: e, password });
    setBusy(false);
    if (error) { fail(mailError(error.message)); return; }
    // Supabase answers a signup for an existing, confirmed address with a user that has no identities
    if (data.user && !data.user.identities?.length) {
      fail('Für diese Adresse gibt es schon ein Konto. Einloggen oder „Passwort vergessen“ nutzen.'); return;
    }
    toCode(e, 'signup');
  }

  /** mails a code (signup confirmation or password reset) and moves to the code step */
  async function mail(e: string, why: CodeFor) {
    setMsg(''); setBusy(true);
    const auth = (await getSupabase()).auth;
    const { error } = why === 'signup'
      ? await auth.resend({ type: 'signup', email: e })
      : await auth.signInWithOtp({ email: e, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      fail(/signups not allowed|not found/i.test(error.message) ? 'Zu dieser Adresse gibt es noch kein Konto — bitte registrieren.' : mailError(error.message));
      return false;
    }
    toCode(e, why);
    return true;
  }

  async function forgot() {
    const e = ethEmail(); if (!e) return;
    if (await mail(e, 'reset')) toast('Code gesendet — danach wählst du ein neues Passwort');
  }

  async function verify(code: string) {
    setMsg(''); setBusy(true);
    holdRedirect.current = codeFor === 'reset'; // set before the session lands
    const { error } = await (await getSupabase()).auth.verifyOtp({ email, token: code, type: codeFor === 'signup' ? 'signup' : 'email' });
    setBusy(false);
    if (error) {
      holdRedirect.current = false;
      fail(/expired|invalid/i.test(error.message) ? 'Code falsch oder abgelaufen — neueste Mail verwenden oder neu senden.' : error.message);
      setDigits(Array(LEN).fill(''));
      setTimeout(() => boxes.current[0]?.focus()); // once the boxes are enabled again
      return;
    }
    if (codeFor === 'reset') { setPassword(''); go('newpw'); return; }
    toast('Willkommen in der Arena!');
    await refresh();
  }

  async function savePassword() {
    if (password.length < MIN_PW) { fail(`Passwort muss mindestens ${MIN_PW} Zeichen haben.`); return; }
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.updateUser({ password });
    setBusy(false);
    if (error) { fail(/different/i.test(error.message) ? 'Bitte ein anderes Passwort als das bisherige wählen.' : error.message); return; }
    toast('Passwort gespeichert — ab jetzt ohne Code');
    holdRedirect.current = false;
    await refresh();
    leave();
  }

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    const d = [...digits];
    if (clean.length > 1) { // paste
      clean.slice(0, LEN - i).split('').forEach((c, k) => { d[i + k] = c; });
      setDigits(d);
      const last = Math.min(i + clean.length, LEN) - 1;
      boxes.current[Math.min(last + 1, LEN - 1)]?.focus();
    } else {
      d[i] = clean;
      setDigits(d);
      if (clean && i < LEN - 1) boxes.current[i + 1]?.focus();
    }
    if (d.every(Boolean)) verify(d.join(''));
  };

  const emailField = (
    <label className="field"><span>ETH-E-Mail</span>
      <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@student.ethz.ch" autoFocus
        value={email} onChange={(e) => setEmail(e.target.value)} /></label>
  );
  const passwordField = (isNew: boolean) => (
    <label className="field"><span>{isNew ? 'Neues Passwort' : 'Passwort'}</span>
      <input className="input" type="password" autoComplete={isNew ? 'new-password' : 'current-password'}
        placeholder={isNew ? `mindestens ${MIN_PW} Zeichen` : ''} minLength={isNew ? MIN_PW : undefined}
        value={password} onChange={(e) => setPassword(e.target.value)} /></label>
  );
  const tabs = (
    <div className="tabs" role="tablist" aria-label="Login oder Registrieren" style={{ justifySelf: 'center' }}>
      {(['login', 'signup'] as const).map((s) => (
        <button key={s} type="button" role="tab" aria-selected={step === s} onClick={() => go(s)}>
          {step === s && <motion.span layoutId="login-tab" className="pill" transition={MOTION.snappy} />}
          {s === 'login' ? <><Icon name="key" size={16} /> Einloggen</> : <><Icon name="mail" size={16} /> Registrieren</>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="head"><h1>Tritt der Arena bei</h1>
        <p>Nur mit ETH-Adresse. Einmal per Code bestätigen, danach einfach mit Passwort einloggen.</p></div>
      <div className="panel login" ref={scope}>
        <span className="ribbon"><Icon name="key" size={14} /> Login</span>
        <AnimatePresence mode="wait" initial={false}>
          {step === 'login' || step === 'signup' ? (
            <motion.form key="auth" noValidate onSubmit={(e) => { e.preventDefault(); if (step === 'login') logIn(); else signUp(); }} {...slide(-1)}>
              {tabs}
              {emailField}
              {passwordField(step === 'signup')}
              <p className="msg" role="alert">{msg}</p>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Einen Moment …' : step === 'login' ? <><Icon name="swords" /> Einloggen</> : <><Icon name="mail" /> Konto erstellen</>}</button>
              {step === 'login' && (
                <div className="links" style={{ justifyContent: 'center' }}>
                  <button type="button" className="link" disabled={busy} onClick={forgot}>Passwort vergessen / noch keins?</button>
                </div>
              )}
              <p style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'center' }}>Wir speichern nur, was das Spiel braucht — siehe <a href="/datenschutz" style={{ textDecoration: 'underline' }}>Datenschutz</a>.</p>
            </motion.form>
          ) : step === 'code' ? (
            <motion.form key="code" noValidate onSubmit={(e) => { e.preventDefault(); if (digits.every(Boolean)) verify(digits.join('')); }} {...slide(1)}>
              <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>Code an <b>{email}</b> gesendet{codeFor === 'reset' ? ', danach wählst du ein neues Passwort' : ''}. ETH-Mails brauchen manchmal 1–2 Minuten — auch Junk prüfen. Immer den Code aus der <b>neuesten</b> Mail nehmen.</p>
              <div className="field"><span>6-stelliger Code</span>
                <div className="otp">
                  {digits.map((d, i) => (
                    <input key={i} ref={(el) => { boxes.current[i] = el; }} className={d ? 'filled' : ''} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Ziffer ${i + 1}`} autoFocus={i === 0} value={d} maxLength={LEN} disabled={busy}
                      onChange={(e) => setAt(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus(); }}
                      onFocus={(e) => e.target.select()} />
                  ))}
                </div>
              </div>
              <p className="msg" role="alert">{msg}</p>
              <button className="btn gold" type="submit" disabled={busy || !digits.every(Boolean)}>{busy ? 'Wird geprüft …' : <><Icon name="swords" /> Bestätigen</>}</button>
              <div className="links">
                <button type="button" className="link" disabled={cooldown > 0 || busy}
                  onClick={async () => { if (await mail(email, codeFor)) toast('Neuer Code gesendet — der alte gilt nicht mehr'); }}>
                  {cooldown > 0 ? `Erneut senden in ${cooldown}s` : 'Code erneut senden'}</button>
                <button type="button" className="link" onClick={() => go('login')}>Zurück</button>
              </div>
            </motion.form>
          ) : (
            <motion.form key="newpw" noValidate onSubmit={(e) => { e.preventDefault(); savePassword(); }} {...slide(1)}>
              <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>E-Mail bestätigt. Wähle jetzt ein Passwort für <b>{email}</b> — damit loggst du dich künftig ohne Code ein.</p>
              {passwordField(true)}
              <p className="msg" role="alert">{msg}</p>
              <button className="btn gold" type="submit" disabled={busy}>{busy ? 'Wird gespeichert …' : <><Icon name="key" /> Passwort speichern</>}</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
