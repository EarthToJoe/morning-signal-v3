import { useState, useEffect } from 'react';

interface Newsletter {
  id: string; name: string; audience: string; creatorDisplayName: string;
  editionCount: number; subscriberCount: number; lastEditionDate: string | null;
}

export default function BrowsePage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/public/newsletters').then(r => r.json()).then(d => { setNewsletters(d.newsletters || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function subscribe(profileId: string, name: string) {
    if (!subscribeEmail.trim()) { setMessage('Enter your email first'); return; }
    setSubscribing(profileId);
    try {
      const res = await fetch('/api/public/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscribeEmail.trim(), profileId }),
      });
      const data = await res.json();
      if (data.success) { setMessage(`✓ ${data.message || 'Subscribed to ' + name}`); }
      else { setMessage(data.error || 'Failed'); }
    } catch { setMessage('Failed to subscribe'); }
    setSubscribing(null);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#0f1a2e', color: 'white', padding: '32px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Morning Signal</h1>
        <p style={{ fontSize: 15, color: '#a0aec0', marginBottom: 16 }}>AI-powered newsletters on any topic. Subscribe to the ones you care about.</p>
        <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input value={subscribeEmail} onChange={e => setSubscribeEmail(e.target.value)} placeholder="Your email address"
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: 8, fontSize: 14 }} />
          <a href="/login" style={{ padding: '10px 16px', background: '#2563eb', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
            Sign In
          </a>
        </div>
        {message && <p style={{ fontSize: 13, color: '#68d391', marginTop: 8 }}>{message}</p>}
      </div>

      {/* Newsletter grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Browse Newsletters</h2>
        {loading ? <p style={{ color: '#888' }}>Loading...</p> : newsletters.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>No newsletters yet. Be the first to create one.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {newsletters.map(nl => (
              <div key={nl.id} style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 18, marginBottom: 4 }}>{nl.name}</h3>
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{nl.audience?.substring(0, 150)}{(nl.audience?.length || 0) > 150 ? '...' : ''}</p>
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      by <span style={{ color: '#555', fontWeight: 500 }}>{nl.creatorDisplayName}</span>
                      {' · '}{nl.editionCount} edition{nl.editionCount !== 1 ? 's' : ''}
                      {' · '}{nl.subscriberCount} subscriber{nl.subscriberCount !== 1 ? 's' : ''}
                      {nl.lastEditionDate && <span> · Last: {new Date(nl.lastEditionDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <button onClick={() => subscribe(nl.id, nl.name)} disabled={subscribing === nl.id}
                    style={{ padding: '8px 16px', background: subscribing === nl.id ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 8,
                      cursor: subscribing === nl.id ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>
                    {subscribing === nl.id ? '...' : 'Subscribe'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 40, padding: 20, background: '#f0f0f5', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
            Disclaimer: Each newsletter created is about 25 cents out of Joe's pocket. Don't pay him back but give him some feedback to make this better!
            <br />Email: <a href="mailto:joehughes92@gmail.com" style={{ color: '#2563eb' }}>joehughes92@gmail.com</a>
          </p>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>Powered by GPT-5.4 · Parallel AI · Morning Signal v3.0</p>
        </div>
      </div>
    </div>
  );
}
