import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Category { category: string; displayName: string; objective: string; searchQueries: string[]; }
interface Preset { name: string; audience: string; categories: Category[]; }

export default function ProfileWizard() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [categories, setCategories] = useState<Category[]>([{ category: '', displayName: '', objective: '', searchQueries: [] }]);
  const [daysBack, setDaysBack] = useState(3);
  const [showForm, setShowForm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api('GET', '/profiles/presets').then(d => setPresets(d.presets)).catch(() => {});
  }, []);

  function loadPreset(preset: Preset) {
    setName(preset.name); setAudience(preset.audience);
    setCategories(preset.categories.map(c => ({ ...c })));
    setShowForm(true);
  }

  function loadBlank() {
    setName(''); setAudience('');
    setCategories([{ category: '', displayName: '', objective: '', searchQueries: [] }]);
    setShowForm(true);
  }

  function updateCategory(idx: number, field: string, value: any) {
    const updated = [...categories];
    (updated[idx] as any)[field] = value;
    if (field === 'displayName') updated[idx].category = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    setCategories(updated);
  }

  function addCategory() { setCategories([...categories, { category: '', displayName: '', objective: '', searchQueries: [] }]); }
  function removeCategory(idx: number) { setCategories(categories.filter((_, i) => i !== idx)); }

  async function quickCreateFromWizard() {
    if (!name.trim()) { alert('Enter a newsletter name'); return; }
    if (categories.filter(c => c.displayName.trim()).length === 0) { alert('Add at least one category'); return; }
    setQuickCreating(true);
    try {
      const profile = await api('POST', '/profiles', {
        name: name.trim(), audience: audience.trim(),
        categories: categories.filter(c => c.displayName.trim()).map(c => ({
          ...c, searchQueries: typeof c.searchQueries === 'string' ? (c.searchQueries as any).split('\n').filter(Boolean) : c.searchQueries,
        })),
      });
      const result = await api('POST', '/pipeline/quick-create', { profileId: profile.id, daysBack });
      navigate(`/editions/${result.correlationId}/phase1`);
    } catch (err: any) { alert('Error: ' + err.message); setQuickCreating(false); }
  }

  async function createAndStart() {
    if (!name.trim()) { alert('Enter a newsletter name'); return; }
    if (categories.filter(c => c.displayName.trim()).length === 0) { alert('Add at least one category'); return; }
    setStarting(true);
    try {
      const profile = await api('POST', '/profiles', {
        name: name.trim(), audience: audience.trim(),
        categories: categories.filter(c => c.displayName.trim()).map(c => ({
          ...c, searchQueries: typeof c.searchQueries === 'string' ? (c.searchQueries as any).split('\n').filter(Boolean) : c.searchQueries,
        })),
      });
      const result = await api('POST', '/pipeline/start', { profileId: profile.id, daysBack });
      navigate(`/editions/${result.correlationId}/phase1`);
    } catch (err: any) { alert('Error: ' + err.message); setStarting(false); }
  }

  const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const btnPrimary = { padding: '10px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 as const };

  return (
    <div>
      <div style={{ background: '#0f3460', color: 'white', padding: '16px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Create Newsletter</h1>
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        {/* Preset cards */}
        <p style={{ color: '#666', marginBottom: 16 }}>Pick a preset to start with, or create your own from scratch.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {presets.map(p => (
            <div key={p.name} onClick={() => loadPreset(p)} style={{ ...cardStyle, cursor: 'pointer', border: '2px solid #ddd', marginBottom: 0 }}>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>{p.name}</h3>
              <p style={{ fontSize: 12, color: '#888' }}>{p.audience.substring(0, 80)}...</p>
              <span style={{ fontSize: 11, color: '#0f3460' }}>{p.categories.length} categories</span>
            </div>
          ))}
          <div onClick={loadBlank} style={{ ...cardStyle, cursor: 'pointer', border: '2px dashed #ccc', textAlign: 'center', marginBottom: 0 }}>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>+ Custom Topic</h3>
            <p style={{ fontSize: 12, color: '#888' }}>Any topic you want</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div style={cardStyle}>
            <h3 style={{ marginBottom: 12 }}>Newsletter Setup</h3>
            <div style={{ marginBottom: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Newsletter name" style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who reads this? (e.g. Startup founders interested in AI)" style={inputStyle} />
            </div>

            <h4 style={{ marginBottom: 8 }}>Topic Categories</h4>
            {categories.map((cat, i) => (
              <div key={i} style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={cat.displayName} onChange={e => updateCategory(i, 'displayName', e.target.value)} placeholder="Category name" style={{ ...inputStyle, fontWeight: 600 }} />
                  {categories.length > 1 && <button onClick={() => removeCategory(i)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Remove</button>}
                </div>
                <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>What should we search for? <span style={{ color: '#aaa', fontWeight: 'normal' }}>(optional — we'll search by category name if left blank)</span></label>
                <textarea value={cat.objective} onChange={e => updateCategory(i, 'objective', e.target.value)} rows={2} placeholder="Describe what you want to find in plain English" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} />
              </div>
            ))}
            <button onClick={addCategory} style={{ padding: '6px 12px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>+ Add Category</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: '#555' }}>News from the last</span>
              <select value={daysBack} onChange={e => setDaysBack(Number(e.target.value))} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}>
                <option value={1}>24 hours</option><option value={2}>2 days</option><option value={3}>3 days</option>
                <option value={5}>5 days</option><option value={7}>1 week</option><option value={14}>2 weeks</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={createAndStart} disabled={starting || quickCreating} style={{ ...btnPrimary, opacity: starting ? 0.6 : 1 }}>
                {starting ? 'Creating & Starting...' : 'Start Pipeline'}
              </button>
              <button onClick={quickCreateFromWizard} disabled={starting || quickCreating} style={{ padding: '10px 20px', background: quickCreating ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: quickCreating ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500 as const }}>
                {quickCreating ? 'Creating newsletter...' : 'Quick Create'}
              </button>
              <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#e0e0e0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
