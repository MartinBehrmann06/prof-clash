'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Me, Profile } from '@/lib/types';

let sbPromise: Promise<SupabaseClient> | null = null;
/** Browser Supabase client, configured from /api/config (one instance per tab) */
export function getSupabase() {
  sbPromise ??= fetch('/api/config').then((r) => r.json()).then((c) =>
    createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }));
  return sbPromise;
}

/** fetch() against our API with the Supabase access token; throws Error(message) on non-2xx */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
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
      const me = await api<Me>('/api/me');
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
    let unsub = () => {};
    getSupabase().then((sb) => {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
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
