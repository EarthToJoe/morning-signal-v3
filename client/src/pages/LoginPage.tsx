import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp, isDevMode } from '../auth';

export default function LoginPage({ onLogin }: { onLogin?: () => void } = {}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Dev mode: skip login
  if (isDevMode) {
    if (onLogin) onLogin();
    navigate('/dashboard');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      if (isRegister) {
        await signUp(email, password);
        setSuccess('Check your email for a confirmation link');
        setError('');
      } else {
        await signIn(email, password);
        if (onLogin) onLogin();
        navigate('/dashboard');
      }
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: 400 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f3460', marginBottom: 4, textAlign: 'center' }}>Morning Signal</h1>
        <p style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 }}>AI-powered newsletter platform</p>

        <form onSubmit={handleSubmit}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 characters)"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {success && <p style={{ color: '#059669', fontSize: 13, marginBottom: 12 }}>{success}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '10px 14px', background: loading ? '#94a3b8' : '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
