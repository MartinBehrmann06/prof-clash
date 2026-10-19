'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase, useSession } from '@/lib/client/session';
import { confetti, useToast } from '@/lib/client/feedback';
import { isEthEmail } from '@/lib/game';

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

const RESEND_AFTER = 90; // seconds — ETH mail filtering can take a minute or two

function Login() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { user, profile, refresh } = useSession();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const go = () => router.replace(`/${next || (profile ? 'battle' : 'setup')}`);
  useEffect(() => { if (user) go(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    const e = email.trim().toLowerCase();
    if (!isEthEmail(e)) { setMsg('That needs to be an ETH address, e.g. you@student.ethz.ch'); return false; }
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      // the database rejects non-ETH signups; Supabase reports that as a generic "Database error"
      setMsg(/database/i.test(error.message) ? 'Only ETH Zurich email addresses can sign up.'
        : /rate|seconds/i.test(error.message) ? 'Too many codes requested — wait a minute and try again.' : error.message);
      return false;
    }
    setEmail(e); setStep('code'); setCode(''); setCooldown(RESEND_AFTER);
    setTimeout(() => codeRef.current?.focus(), 50);
    return true;
  }

  async function verify() {
    if (!/^\d{6,8}$/.test(code)) { setMsg('Enter the code from the email.'); return; }
    setMsg(''); setBusy(true);
    const { error } = await (await getSupabase()).auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) { setMsg(/expired|invalid/i.test(error.message) ? 'That code is wrong or expired — use the newest email, or resend.' : error.message); return; }
    await refresh();
    toast('Welcome to the clan! 🛡️');
    confetti(innerWidth / 2, innerHeight / 3, 40);
  }

  return (
    <div className="view view-enter">
      <div className="setup-head"><h1>Join the clan</h1><p>Only ETH Zurich students and staff can battle. We’ll email you a code to confirm it’s really you.</p></div>
      <div className="panel login-panel"><div className="panel-title stroke">Log in</div>
        {step === 'email' ? (
          <form className="login-step" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="field"><span>Your ETH email</span>
              <input className="search" type="email" inputMode="email" autoComplete="email" placeholder="you@student.ethz.ch" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <p className="login-msg" role="alert">{msg}</p>
            <button className="btn" type="submit" disabled={busy}>📨 Send me a code</button>
          </form>
        ) : (
          <form className="login-step" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <p className="login-sent">We sent a code to <b>{email}</b>. ETH mail can take <b>1–2 minutes</b> — check junk too.
              Always use the code from the <b>newest</b> email.</p>
            <label className="field"><span>Confirmation code</span>
              <input ref={codeRef} className="search code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="••••••"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
            <p className="login-msg" role="alert">{msg}</p>
            <button className="btn" type="submit" disabled={busy}>⚔️ Confirm &amp; enter</button>
            <div className="login-links">
              <button type="button" className="linkish" disabled={cooldown > 0 || busy}
                onClick={async () => { if (await send()) toast('New code sent 📨 — the old one no longer works'); }}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
              <button type="button" className="linkish" onClick={() => { setStep('email'); setMsg(''); }}>Use another email</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
