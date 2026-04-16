import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

interface Profile {
  id: string; name: string; audience: string; editionCount: number;
}
interface Edition {
  correlation_id: string; status: string; edition_number: number; started_at: string; lead_headline?: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editions, setEditions] = useState<Record<string, Edition[]>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<{ displayName: string; email: string }>({ displayName: '', email: '' });

  useEffect(() => {
    api('GET', '/profiles').then(d => setProfiles(d.profiles || [])).catch(() => {});
    api('GET', '/user/me').then(d => setUserInfo({ displayName: d.displayName || '', email: d.email || '' })).catch(() => {});
  }, [location.pathname]);

  async function loadEditions(profileId: string) {
    if (editions[profileId]) return;
    try {
      const data = await api('GET', `/editions/profile/${profileId}/list`);
      setEditions(prev => ({ ...prev, [profileId]: (data.editions || []).slice(0, 5) }));
    } catch { setEditions(prev => ({ ...prev, [profileId]: [] })); }
  }

  const sidebarWidth = collapsed ? 56 : 240;
  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItem = (label: string, path: string, icon: string) => (
    <div onClick={() => navigate(path)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
        background: isActive(path) ? 'rgba(255,255,255,0.12)' : 'transparent', borderRadius: 8, marginBottom: 2,
        color: isActive(path) ? '#fff' : '#b0b8c8', fontSize: 14, transition: 'background 0.15s' }}
      onMouseEnter={e => { if (!isActive(path)) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); }}
      onMouseLeave={e => { if (!isActive(path)) (e.currentTarget.style.background = 'transparent'); }}>
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: sidebarWidth, background: '#0f1a2e', color: '#e0e4ec', display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s', flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: collapsed ? '16px 8px' : '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!collapsed && (
              <div onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>Morning Signal</div>
                <div style={{ fontSize: 11, color: '#6b7a90', marginTop: 2 }}>AI Newsletter Platform</div>
              </div>
            )}
            <button onClick={() => setCollapsed(!collapsed)}
              style={{ background: 'none', border: 'none', color: '#6b7a90', cursor: 'pointer', fontSize: 16, padding: 4 }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? '▶' : '◀'}
            </button>
          </div>
        </div>

        {/* User info */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{userInfo.displayName || 'Loading...'}</div>
            <div style={{ fontSize: 11, color: '#6b7a90' }}>{userInfo.email}</div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ padding: '12px 8px', flex: 1 }}>
          {navItem('Dashboard', '/dashboard', '📊')}
          {navItem('Create Newsletter', '/profiles/new', '➕')}

          {/* Newsletter profiles */}
          {!collapsed && profiles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 16px', marginBottom: 8 }}>
                Your Newsletters <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(publisher)</span>
              </div>
              {profiles.slice(0, 10).map(p => (
                <div key={p.id} style={{ marginBottom: 4 }}>
                  <div onClick={() => navigate(`/profiles/${p.id}/start`)}
                    style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: 8,
                      background: location.pathname.includes(p.id) ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: location.pathname.includes(p.id) ? '#fff' : '#b0b8c8', fontSize: 13, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => { if (!location.pathname.includes(p.id)) e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7a90' }}>{p.editionCount} edition{p.editionCount !== 1 ? 's' : ''}</div>
                  </div>
                  {location.pathname.includes(p.id) && (
                    <ProfileSubMenu profileId={p.id} navigate={navigate} location={location}
                      editions={editions[p.id]} loadEditions={loadEditions} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tools section */}
          {!collapsed && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 16px', marginBottom: 8 }}>
                Tools
              </div>
              {navItem('Settings', '/settings', '⚙️')}
            </div>
          )}
        </div>

        {/* Footer */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: '#6b7a90' }}>
            <div style={{ marginBottom: 8 }}>
              <span onClick={async () => { const { signOut } = await import('../auth'); await signOut(); window.location.href = '/login'; }}
                style={{ cursor: 'pointer', color: '#8899aa', fontSize: 12 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#8899aa')}>
                Sign Out
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.5, marginBottom: 6 }}>
              Disclaimer: Each newsletter created is about 25 cents out of Joe's pocket. Don't pay him back but give him some feedback to make this better!
              <br /><a href="mailto:morningsignal4@gmail.com" style={{ color: '#6b7a90' }}>morningsignal4@gmail.com</a>
            </div>
            <div style={{ fontSize: 10, color: '#4a5568' }}>Powered by GPT-5.4 · Parallel AI</div>
            <div style={{ marginTop: 4 }}>v3.0 · hughesnode.com</div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.2s', minHeight: '100vh', background: '#f5f5f7' }}>
        {children}
      </div>
    </div>
  );
}

function ProfileSubMenu({ profileId, navigate, location, editions, loadEditions }: {
  profileId: string; navigate: any; location: any; editions?: Edition[]; loadEditions: (id: string) => void;
}) {
  useEffect(() => { loadEditions(profileId); }, [profileId]);

  const subLink = (label: string, path: string) => (
    <div onClick={() => navigate(path)} style={{ padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#8899aa', borderRadius: 4 }}
      onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#8899aa')}>
      ▸ {label}
    </div>
  );

  const statusDot = (status: string) => {
    const color = status === 'delivered' ? '#22c55e' : status === 'awaiting_review' ? '#f59e0b' : status === 'awaiting_selection' ? '#3b82f6' : '#94a3b8';
    return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: color, marginRight: 6 }} />;
  };

  return (
    <div style={{ paddingLeft: 28 }}>
      {subLink('New Edition', `/profiles/${profileId}/start`)}
      {subLink('Edit Profile', `/profiles/${profileId}/edit`)}
      {subLink('Subscribers', `/profiles/${profileId}/subscribers`)}
      {subLink('Sources', `/profiles/${profileId}/sources`)}
      {editions && editions.length > 0 && (
        <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
          <div style={{ fontSize: 10, color: '#556', padding: '2px 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Recent</div>
          {editions.map(ed => (
            <div key={ed.correlation_id} onClick={() => navigate(`/editions/${ed.correlation_id}/phase1`)}
              style={{ padding: '3px 12px', cursor: 'pointer', fontSize: 11, color: '#8899aa', borderRadius: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#8899aa')}>
              {statusDot(ed.status)}
              <span>#{ed.edition_number} · {new Date(ed.started_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
