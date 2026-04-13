import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Category { id: string; category: string; displayName: string; objective: string; searchQueries: string[]; }

export default function ProfileStart() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [daysBack, setDaysBack] = useState(3);
  const [starting, setStarting] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);

  useEffect(() => {
    api('GET', `/profiles/${profileId}`).then(data => {
      setProfile(data);
      setCategories(data.categories || []);
    }).catch(err => alert('Failed to load profile: ' + err.message));
  }, [profileId]);

  async function startPipeline() {
    setStarting(true);
    try {
      const result = await api('POST', '/pipeline/start', { profileId, daysBack });
      navigate(`/editions/${result.correlationId}/phase1`);
    } catch (err: any) { alert('Error: ' + err.message); setStarting(false); }
  }

  async function quickCreate() {
    setQuickCreating(true);
    try {
      const result = await api('POST', '/pipeline/quick-create', { profileId, daysBack });
      navigate(`/editions/${result.correlationId}/phase1`);
    } catch (err: any) { alert('Error: ' + err.message); setQuickCreating(false); }
  }

  const card = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };
  const input = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const btnStyle = (bg: string, disabled = false) => ({ padding: '10px 20px', background: disabled ? '#94a3b8' : bg, color: 'white', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' as const : 'pointer' as const, fontSize: 14, fontWeight: 500 as const });

  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading profile...</div>;

  return (
    <div>
      <div style={{ background: '#0f3460', color: 'white', padding: '16px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>New Edition — {profile.name}</h1>
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={card}>
          <h3 style={{ marginBottom: 4 }}>{profile.name}</h3>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>{profile.audience}</p>

          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Topic Categories</h4>
          {categories.map((cat, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{cat.displayName}</div>
              {cat.objective && <p style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{cat.objective}</p>}
              {cat.searchQueries?.length > 0 && (
                <p style={{ fontSize: 12, color: '#888' }}>Keywords: {cat.searchQueries.join(', ')}</p>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#555' }}>News from the last</span>
            <select value={daysBack} onChange={e => setDaysBack(Number(e.target.value))} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}>
              <option value={1}>24 hours</option><option value={2}>2 days</option><option value={3}>3 days</option>
              <option value={5}>5 days</option><option value={7}>1 week</option><option value={14}>2 weeks</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={startPipeline} disabled={starting || quickCreating} style={btnStyle('#0f3460', starting)}>
              {starting ? 'Starting...' : 'Start Pipeline (review stories)'}
            </button>
            <button onClick={quickCreate} disabled={starting || quickCreating} style={btnStyle('#059669', quickCreating)}>
              {quickCreating ? 'Creating...' : 'Quick Create (auto-select)'}
            </button>
            <button onClick={() => navigate('/dashboard')} style={btnStyle('#94a3b8')}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
