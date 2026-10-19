import { handler } from '@/lib/server/http';

// public config for the browser's Supabase client (the anon key is meant to be public)
export const GET = handler(async () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
}));
