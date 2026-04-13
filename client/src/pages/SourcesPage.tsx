import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface SourceCollection { id: string; name: string; collectionType: string; domains: string[]; }

export default function SourcesPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<SourceCollection[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'preferred' | 'excluded'>('preferred');
  const [newDomains, setNewDomains] = useState('');
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    Promise.all([
      api('GET', `/sources/${profileId}`),
      api('GET', `/profiles/${profileId}`),
    ]).then(([srcData, profData]) => {
      setCollections(srcData.collections || []);
      setProfileName(profData.name || '');
    }).catch(() => {});
  }, [profileId]);

  async function addCollection() {
    if (!newName.trim()) return;
    const domains = newDomains.split(/[\n,;]/).map(d => d.trim().toLowerCase()).filter(Boolean);
    try {
      const data = await api('POST', `/sources/${profileId}`, { name: newName, collectionType: newType, domains });
      setCollections(prev => [...prev, data.collection]);
      setNewName(''); setNewDomains('');
    } catch (err: any) { alert(err.message); }
  }

  async function deleteCollection(id: string) {
    try {
      await api('DELETE', `/sources/${profileId}/${id}`);
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch (err: any) { alert(err.message); }
  }

  const card = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };
  const input = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const btn = (bg: string) => ({ padding: '8px 16px', background: bg, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 as const });
  const preferred = collections.filter(c => c.collectionType === 'preferred');
  const excluded = collections.filter(c => c.collectionType === 'excluded');

  return (
    <div>
      <div style={{ background: '#0f3460', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>Morning Signal</h1>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Source Collections — {profileName}</span>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Source Collections</h2>
          <button onClick={() => navigate('/dashboard')} style={btn('#94a3b8')}>← Dashboard</button>
        </div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Preferred sources are prioritized in search results. Excluded sources are blocked. These apply automatically when you run the pipeline.
        </p>

        {/* Add new */}
        <div style={card}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Add Source Collection</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Collection name (e.g. Trusted Defense Sources)" style={{ ...input, flex: 1 }} />
            <select value={newType} onChange={e => setNewType(e.target.value as any)} style={{ ...input, width: 130 }}>
              <option value="preferred">Preferred</option>
              <option value="excluded">Excluded</option>
            </select>
          </div>
          <textarea value={newDomains} onChange={e => setNewDomains(e.target.value)} rows={3}
            placeholder="Enter domains — one per line or comma-separated (e.g. reuters.com, breakingdefense.com)" style={{ ...input, width: '100%', resize: 'vertical' as const }} />
          <button onClick={addCollection} style={{ ...btn('#2563eb'), marginTop: 8 }}>Add Collection</button>
        </div>

        {/* Preferred */}
        {preferred.length > 0 && (
          <div style={card}>
            <h3 style={{ fontSize: 15, marginBottom: 8, color: '#059669' }}>✓ Preferred Sources</h3>
            {preferred.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{c.domains.join(', ')}</div>
                </div>
                <button onClick={() => deleteCollection(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Excluded */}
        {excluded.length > 0 && (
          <div style={card}>
            <h3 style={{ fontSize: 15, marginBottom: 8, color: '#dc2626' }}>✗ Excluded Sources</h3>
            {excluded.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{c.domains.join(', ')}</div>
                </div>
                <button onClick={() => deleteCollection(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {collections.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: '#888' }}>
            <p>No source collections yet. Add preferred or excluded domains above.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Default excluded: linkedin.com, facebook.com, twitter.com, youtube.com (always applied)</p>
          </div>
        )}
      </div>
    </div>
  );
}
