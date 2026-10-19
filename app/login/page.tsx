'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { getSupabase, useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { isEthEmail } from '@/lib/game';

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

const RESEND_AFTER = 90; // ETH mail filtering can take a minute or two
const LEN = 6;

function Login() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { user, profile, refresh } = useSession();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [scope, animate] = useAnimate();

  useEffect(() => { if (user) router.replace(next ? `/${next}` : profile ? '/' : '/setup'); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const shake = () => animate(scope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4 });
  const fail = (m: string) => { setMsg(m); shake(); };

  async function send() {
    const e = email.trim().toLowerCase();
    if (!isEthEmail(e)) { fail('Bitte eine ETH-Adresse verwenden, z. B. name@student.ethz.ch'); return false; }
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      // the database rejects non-ETH signups; Supabase reports that as a generic "Database error"
      fail(/database/i.test(error.message) ? 'Nur ETH-Adressen können sich anmelden.'
        : /rate|seconds/i.test(error.message) ? 'Zu viele Codes angefordert — bitte kurz warten.' : error.message);
      return false;
    }
    setEmail(e); setStep('code'); setDigits(Array(LEN).fill('')); setCooldown(RESEND_AFTER);
    setTimeout(() => boxes.current[0]?.focus(), 60);
    return true;
  }

  async function verify(code: string) {
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) {
      fail(/expired|invalid/i.test(error.message) ? 'Code falsch oder abgelaufen — neueste Mail verwenden oder neu senden.' : error.message);
      setDigits(Array(LEN).fill('')); boxes.current[0]?.focus();
      return;
    }
    toast('Willkommen in der Prof Arena');
    await refresh();
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

  return (
    <div className="page">
      <div className="head center"><span className="eyebrow">Anmelden</span><h1 className="display">Deine Stimme zählen lassen</h1>
        <p className="muted" style={{ margin: 0, maxWidth: '44ch' }}>Nur mit ETH-Adresse. Wir schicken dir einen 6-stelligen Code — kein Passwort.</p></div>
      <div className="panel" ref={scope}>
        <AnimatePresence mode="wait" initial={false}>
          {step === 'email' ? (
            <motion.form key="email" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}
              initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={MOTION.snappy}>
              <label className="field"><span>ETH-E-Mail</span>
                <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@student.ethz.ch" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <p className="msg" role="alert">{msg}</p>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Wird gesendet …' : 'Code senden'}</button>
            </motion.form>
          ) : (
            <motion.form key="code" noValidate onSubmit={(e) => { e.preventDefault(); if (digits.every(Boolean)) verify(digits.join('')); }}
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={MOTION.snappy}>
              <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>Code an <b style={{ color: 'var(--ink)' }}>{email}</b> gesendet. ETH-Mails brauchen manchmal 1–2 Minuten — auch Junk prüfen. Immer den Code aus der <b>neuesten</b> Mail nehmen.</p>
              <div className="field"><span>6-stelliger Code</span>
                <div className="otp">
                  {digits.map((d, i) => (
                    <input key={i} ref={(el) => { boxes.current[i] = el; }} className={d ? 'filled' : ''} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Ziffer ${i + 1}`} value={d} maxLength={LEN} disabled={busy}
                      onChange={(e) => setAt(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus(); }}
                      onFocus={(e) => e.target.select()} />
                  ))}
                </div>
              </div>
              <p className="msg" role="alert">{msg}</p>
              <button className="btn" type="submit" disabled={busy || !digits.every(Boolean)}>{busy ? 'Wird geprüft …' : 'Bestätigen'}</button>
              <div className="links">
                <button type="button" className="link" disabled={cooldown > 0 || busy}
                  onClick={async () => { if (await send()) toast('Neuer Code gesendet — der alte gilt nicht mehr'); }}>
                  {cooldown > 0 ? `Erneut senden in ${cooldown}s` : 'Code erneut senden'}</button>
                <button type="button" className="link" onClick={() => { setStep('email'); setMsg(''); }}>Andere Adresse</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
