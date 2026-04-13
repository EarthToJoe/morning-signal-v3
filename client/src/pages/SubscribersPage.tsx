import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Subscriber { id: string; email: string; status: string; subscribedAt: string; }

export default function SubscribersPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    Promise.all([
      api('GET', `/subscribers/${profileId}/subscribers`),
      api('GET', `/profiles/${profileId}`),
    ]).then(([subData, profData]) => {
      setSubscribers(subData.subscribers || []);
      setProfileName(profData.name || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [profileId]);

  async function addSubscriber() {
    if (!newEmail.trim()) return;
    try {
      const data = await api('POST', `/subscribers/${profileId}/subscribers`, { email: newEmail.trim() });
      setSubscribers(prev => [...prev, data.subscriber]);
      setNewEmail('');
    } catch (err: any) { alert(err.message); }
  }

  async function removeSubscriber(id: string) {
    try {
      await api('DELETE', `/subscribers/${profileId}/subscribers/${id}`);
      setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: 'unsubscribed' } : s));
    } catch (err: any) { alert(err.message); }
  }

  async function importBulk() {
    const emails = bulkEmails.split(/[\n,;]/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    try {
      const result = await api('POST', `/subscribers/${profileId}/subscribers/import`, { emails });
      alert(`Added: ${result.added}, Skipped: ${result.skipped}, Errors: ${result.errors?.length || 0}`);
      setBulkEmails('');
      setShowBulk(false);
      // Reload
      const data = await api('GET', `/subscribers/${profileId}/subscribers`);
      setSubscribers(data.subscribers || []);
    } catch (err: any) { alert(err.message); }
  }

  const active = subscribers.filter(s => s.status === 'active');
  const unsubscribed = subscribers.filter(s => s.status === 'unsubscribed');
  const card = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };
  const input = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const btn = (bg: string) => ({ padding: '8px 16px', background: bg, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 as const });

  return (
    <div>
      <div style={{ background: '#0f3460', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>Morning Signal</h1>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Subscribers — {profileName}</span>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Subscribers <span style={{ fontSize: 14, color: '#888', fontWeight: 400 }}>({active.length} active)</span></h2>
          <button onClick={() => navigate('/dashboard')} style={btn('#94a3b8')}>← Dashboard</button>
        </div>

        {/* Add subscriber */}
        <div style={card}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubscriber()}
              placeholder="Enter email address..." style={{ ...input, flex: 1 }} />
            <button onClick={addSubscriber} style={btn('#2563eb')}>Add</button>
            <button onClick={() => setShowBulk(!showBulk)} style={btn('#6366f1')}>{showBulk ? 'Hide Bulk' : 'Bulk Import'}</button>
          </div>
          {showBulk && (
            <div style={{ marginTop: 12 }}>
              <textarea value={bulkEmails} onChange={e => setBulkEmails(e.target.value)} rows={4}
                placeholder="Paste emails — one per line, or comma/semicolon separated" style={{ ...input, width: '100%', resize: 'vertical' as const }} />
              <button onClick={importBulk} style={{ ...btn('#6366f1'), marginTop: 8 }}>Import All</button>
            </div>
          )}
        </div>

        {/* Active subscribers */}
        {loading ? <p style={{ color: '#888' }}>Loading...</p> : (
          <div style={card}>
            {active.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>No active subscribers yet.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: '#888' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: '#888' }}>Since</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 0', fontSize: 14 }}>{s.email}</td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: '#888' }}>{new Date(s.subscribedAt).toLocaleDateString()}</td>
                      <td><button onClick={() => removeSubscriber(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Unsubscribed */}
        {unsubscribed.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#888' }}>Unsubscribed ({unsubscribed.length})</summary>
            <div style={{ ...card, marginTop: 8 }}>
              {unsubscribed.map(s => (
                <div key={s.id} style={{ padding: '4px 0', fontSize: 13, color: '#aaa' }}>{s.email}</div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
