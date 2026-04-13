import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// If no Supabase keys, we're in dev mode
export const isDevMode = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const supabase = isDevMode ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  email: string | null;
  loading: boolean;
}

export async function getSession(): Promise<AuthState> {
  if (isDevMode) return { isLoggedIn: true, userId: 'dev-user-id', email: 'dev@localhost', loading: false };
  if (!supabase) return { isLoggedIn: false, userId: null, email: null, loading: false };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return { isLoggedIn: true, userId: session.user.id, email: session.user.email || null, loading: false };
  return { isLoggedIn: false, userId: null, email: null, loading: false };
}

export async function signUp(email: string, password: string) {
  if (isDevMode) return { user: { id: 'dev-user-id', email }, error: null };
  if (!supabase) throw new Error('Auth not configured');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return { user: data.user, error: null };
}

export async function signIn(email: string, password: string) {
  if (isDevMode) return { user: { id: 'dev-user-id', email }, session: { access_token: 'dev-token' }, error: null };
  if (!supabase) throw new Error('Auth not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return { user: data.user, session: data.session, error: null };
}

export async function signOut() {
  if (isDevMode) return;
  if (supabase) await supabase.auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  if (isDevMode) return 'dev-token';
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}
