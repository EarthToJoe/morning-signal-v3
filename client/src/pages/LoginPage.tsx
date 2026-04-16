import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp, isDevMode, getAccessToken } from '../auth';

export default function LoginPage({ onLogin }: { onLogin?: () => void } = {}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  if (isDevMode) {
    if (onLogin) onLogin();
    navigate('/dashboard');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email || !password) { setError('Email and password required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (isRegister && !username.trim()) { setError('Choose a username'); return; }
    if (isRegister && username.trim().toLowerCase() === 'anonymous') { setError('"Anonymous" is reserved — pick a different username'); return; }
    setLoading(true);
    try {
      if (isRegister) {
        await signUp(email, password);
        // Try to log in immediately and save the username
        try {
          await signIn(email, password);
          const token = await getAccessToken();
          if (token) {
            await fetch('/api/user/me', {
              method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ displayName: username.trim() }),
            });
          }
          if (onLogin) onLogin();
          navigate('/dashboard');
        } catch {
          setSuccess('Account created! Check your email for a confirmation link, then sign in.');
        }
      } else {
        await signIn(email, password);
        if (onLogin) onLogin();
        navigate('/dashboard');
      }
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' as const };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: 400 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f3460', marginBottom: 4, textAlign: 'center' }}>Morning Signal</h1>
        <p style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 }}>AI-powered newsletter platform</p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username"
              style={inputStyle} autoComplete="off" />
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 characters)" style={inputStyle} />
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {success && <p style={{ color: '#059669', fontSize: 13, marginBottom: 12 }}>{success}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '10px 14px', background: loading ? '#94a3b8' : '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#aaa' }}>
          <a href="/browse" style={{ color: '#888' }}>← Browse newsletters without signing in</a>
        </p>
      </div>
    </div>
  );
}
