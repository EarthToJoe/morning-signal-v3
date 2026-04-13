import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Profile {
  id: string; name: string; audience: string; editionCount: number;
  lastEditionDate: string | null; createdAt: string;
}

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [editions, setEditions] = useState<Record<string, any[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    api('GET', '/profiles').then(data => { setProfiles(data.profiles); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function loadEditions(profileId: string) {
    if (expandedProfile === profileId) { setExpandedProfile(null); return; }
    setExpandedProfile(profileId);
    if (!editions[profileId]) {
      try {
        const data = await api('GET', `/editions/profile/${profileId}/list`);
        setEditions(prev => ({ ...prev, [profileId]: data.editions || [] }));
      } catch { setEditions(prev => ({ ...prev, [profileId]: [] })); }
    }
  }

  const [startingProfile, setStartingProfile] = useState<string | null>(null);
  const [quickCreating, setQuickCreating] = useState<string | null>(null);

  async function startEdition(profileId: string) {
    navigate(`/profiles/${profileId}/start`);
  }

  async function deleteProfile(profileId: string, name: string) {
    if (!confirm(`Delete "${name}" and all its editions? This cannot be undone.`)) return;
    try {
      await api('DELETE', `/profiles/${profileId}`);
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    } catch (err: any) { alert('Delete failed: ' + err.message); }
  }

  async function quickCreate(profileId: string) {
    setQuickCreating(profileId);
    try {
      const result = await api('POST', '/pipeline/quick-create', { profileId });
      navigate(`/editions/${result.correlationId}/phase1`);
    } catch (err: any) { alert('Failed: ' + err.message); setQuickCreating(null); }
  }

  return (
    <div>
      <div style={{ background: '#0f3460', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Morning Signal</h1>
        <span style={{ fontSize: 13, opacity: 0.8 }}>AI Newsletter Platform</span>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22 }}>Your Newsletters</h2>
          <button onClick={() => navigate('/profiles/new')} style={{ padding: '10px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            + Create Newsletter
          </button>
        </div>

        {loading ? <p style={{ color: '#888' }}>Loading...</p> : profiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>No newsletters yet</p>
            <p style={{ color: '#888', marginBottom: 20 }}>Create your first newsletter to get started.</p>
            <button onClick={() => navigate('/profiles/new')} style={{ padding: '12px 24px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
              Create Newsletter
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {profiles.map(p => (
              <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 17, marginBottom: 4 }}>{p.name}</h3>
                    <p style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{p.audience?.substring(0, 100)}{(p.audience?.length || 0) > 100 ? '...' : ''}</p>
                    <span style={{ fontSize: 12, color: '#aaa' }}>
                      {p.editionCount} edition{p.editionCount !== 1 ? 's' : ''}
                      {p.lastEditionDate ? ` · Last: ${new Date(p.lastEditionDate).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => navigate(`/profiles/${p.id}/start`)} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      New Edition
                    </button>
                    <button onClick={() => quickCreate(p.id)} disabled={quickCreating === p.id} style={{ padding: '8px 16px', background: quickCreating === p.id ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: quickCreating === p.id ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {quickCreating === p.id ? 'Creating...' : 'Quick Create'}
                    </button>
                  </div>
                </div>
                {/* Edition history toggle */}
                <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => loadEditions(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', padding: 0 }}>
                      {expandedProfile === p.id ? '▼ Hide editions' : '▶ Show past editions'}
                    </button>
                    <button onClick={() => deleteProfile(p.id, p.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626', padding: 0, marginLeft: 'auto' }}>
                      Delete
                    </button>
                    <button onClick={() => navigate(`/profiles/${p.id}/subscribers`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#059669', padding: 0, marginLeft: 8 }}>
                      Subscribers
                    </button>
                    <button onClick={() => navigate(`/profiles/${p.id}/sources`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', padding: 0, marginLeft: 8 }}>
                      Sources
                    </button>
                  </div>
                  {expandedProfile === p.id && editions[p.id] && (
                    <div style={{ marginTop: 8 }}>
                      {editions[p.id].length === 0 ? (
                        <p style={{ fontSize: 12, color: '#aaa' }}>No editions yet</p>
                      ) : editions[p.id].map((ed: any) => (
                        <div key={ed.correlation_id} onClick={() => navigate(`/editions/${ed.correlation_id}/phase1`)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, marginBottom: 4, cursor: 'pointer', fontSize: 12 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>#{ed.edition_number}</span>
                            <span style={{ color: '#888', marginLeft: 8 }}>{new Date(ed.started_at).toLocaleDateString()}</span>
                            {ed.lead_headline && <span style={{ color: '#555', marginLeft: 8 }}>{ed.lead_headline.substring(0, 50)}{ed.lead_headline.length > 50 ? '...' : ''}</span>}
                          </div>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                            background: ed.status === 'delivered' ? '#dcfce7' : ed.status === 'awaiting_review' ? '#fef3c7' : ed.status === 'awaiting_selection' ? '#dbeafe' : '#f3f4f6',
                            color: ed.status === 'delivered' ? '#166534' : ed.status === 'awaiting_review' ? '#92400e' : ed.status === 'awaiting_selection' ? '#1e40af' : '#6b7280' }}>
                            {ed.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
