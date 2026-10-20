'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Me, Profile } from '@/lib/types';

let sbPromise: Promise<SupabaseClient> | null = null;
/**
 * Browser Supabase client, configured from /api/config (one instance per tab).
 * The library is loaded on demand (in parallel with the config), so it stays out of the first page load.
 */
export function getSupabase() {
  sbPromise ??= Promise.all([fetch('/api/config').then((r) => r.json()), import('@supabase/supabase-js')]).then(([c, { createClient }]) =>
    createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }));
  return sbPromise;
}

/** Supabase keeps a session in localStorage under sb-<project>-auth-token; without one there is no token to send */
export function maybeSignedIn() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** fetch() against our API with the Supabase access token; throws Error(message) on non-2xx */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  // guests don't wait for the auth library before their first request
  const session = maybeSignedIn() ? (await (await getSupabase()).auth.getSession()).data.session : null;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'Something went wrong'), { status: res.status });
  return json as T;
}

type Session = {
  ready: boolean;
  user: Me['user'];
  profile: Profile | null;
  refresh: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me['user']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    try {
      // no stored session means a guest: no need to ask the server, the page can start at once
      const me: Me = maybeSignedIn() ? await api<Me>('/api/me') : { user: null, profile: null };
      setUser(me.user);
      setProfile(me.profile);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    let alive = true, unsub = () => {};
    const listen = () => getSupabase().then((sb) => {
      if (!alive) return;
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
      });
      unsub = () => data.subscription.unsubscribe();
    });
    // a guest needs the auth library only to log in (the login page loads it itself and refreshes after),
    // so it loads once the page has started instead of competing with it on a phone's CPU
    const later = maybeSignedIn() ? (listen(), undefined) : setTimeout(listen, 2500);
    return () => { alive = false; clearTimeout(later); unsub(); };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await (await getSupabase()).auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(() => ({ ready, user, profile, refresh, setProfile, signOut }), [ready, user, profile, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
