import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Category { id?: string; category: string; displayName: string; objective: string; searchQueries: string[]; }

export default function ProfileEdit() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [sectionNames, setSectionNames] = useState({ lead: 'Lead Story', briefing: 'Quick Hits', watch: 'Watch List' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('GET', `/profiles/${profileId}`).then(data => {
      setName(data.name); setAudience(data.audience || '');
      setCategories(data.categories || []);
      if (data.sectionNames) setSectionNames(data.sectionNames);
      setLoading(false);
    }).catch(err => { alert('Failed to load: ' + err.message); setLoading(false); });
  }, [profileId]);

  function updateCategory(idx: number, field: string, value: any) {
    const updated = [...categories];
    (updated[idx] as any)[field] = value;
    if (field === 'displayName') updated[idx].category = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    setCategories(updated);
  }
  function addCategory() { setCategories([...categories, { category: '', displayName: '', objective: '', searchQueries: [] }]); }
  function removeCategory(idx: number) { setCategories(categories.filter((_, i) => i !== idx)); }

  async function save() {
    setSaving(true);
    try {
      await api('PUT', `/profiles/${profileId}`, {
        name: name.trim(), audience: audience.trim(), sectionNames,
        categories: categories.filter(c => c.displayName?.trim()).map(c => ({
          ...c, searchQueries: typeof c.searchQueries === 'string' ? (c.searchQueries as any).split('\n').filter(Boolean) : c.searchQueries,
        })),
      });
      navigate('/dashboard');
    } catch (err: any) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }

  const input = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const card = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Edit Newsletter</h2>
      <div style={card}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Newsletter Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...input, fontSize: 16, fontWeight: 600 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Audience</label>
          <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who reads this?" style={input} />
        </div>

        <h4 style={{ marginBottom: 8 }}>Topic Categories</h4>
        {categories.map((cat, i) => (
          <div key={i} style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={cat.displayName} onChange={e => updateCategory(i, 'displayName', e.target.value)} placeholder="Category name" style={{ ...input, fontWeight: 600 }} />
              {categories.length > 1 && <button onClick={() => removeCategory(i)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Remove</button>}
            </div>
            <label style={{ fontSize: 12, color: '#555', marginBottom: 4, display: 'block' }}>Search description <span style={{ color: '#aaa' }}>(optional)</span></label>
            <textarea value={cat.objective || ''} onChange={e => updateCategory(i, 'objective', e.target.value)} rows={2} placeholder="What to search for" style={{ ...input, minHeight: 60, resize: 'vertical' as const }} />
          </div>
        ))}
        <button onClick={addCategory} style={{ padding: '6px 12px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>+ Add Category</button>

        <h4 style={{ marginBottom: 8, fontSize: 14 }}>Section Names</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#888' }}>Lead</label>
            <input value={sectionNames.lead} onChange={e => setSectionNames({ ...sectionNames, lead: e.target.value })} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#888' }}>Briefing</label>
            <input value={sectionNames.briefing} onChange={e => setSectionNames({ ...sectionNames, briefing: e.target.value })} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#888' }}>Watch</label>
            <input value={sectionNames.watch} onChange={e => setSectionNames({ ...sectionNames, watch: e.target.value })} style={input} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 20px', background: saving ? '#94a3b8' : '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#e0e0e0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
