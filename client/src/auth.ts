// Supabase auth — lazy-loaded when needed
// Set to false to enable real Supabase Auth login
export const isDevMode = false;

let supabase: any = null;

async function getSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (url && key) supabase = createClient(url, key);
  return supabase;
}

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  email: string | null;
  loading: boolean;
}

export async function getSession(): Promise<AuthState> {
  if (isDevMode) return { isLoggedIn: true, userId: 'dev-user-id', email: 'dev@localhost', loading: false };
  const sb = await getSupabase();
  if (!sb) return { isLoggedIn: false, userId: null, email: null, loading: false };
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) return { isLoggedIn: true, userId: session.user.id, email: session.user.email || null, loading: false };
  return { isLoggedIn: false, userId: null, email: null, loading: false };
}

export async function signUp(email: string, password: string) {
  if (isDevMode) return { user: { id: 'dev-user-id', email }, error: null };
  const sb = await getSupabase();
  if (!sb) throw new Error('Auth not configured');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return { user: data.user, error: null };
}

export async function signIn(email: string, password: string) {
  if (isDevMode) return { user: { id: 'dev-user-id', email }, session: { access_token: 'dev-token' }, error: null };
  const sb = await getSupabase();
  if (!sb) throw new Error('Auth not configured');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return { user: data.user, session: data.session, error: null };
}

export async function signOut() {
  if (isDevMode) return;
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  if (isDevMode) return 'dev-token';
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}
