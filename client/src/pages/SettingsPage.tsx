import { useState, useEffect } from 'react';
import { api } from '../api';

interface ManagedPrompt {
  stage: string; promptText: string; isDefault: boolean; savedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  content_researcher: 'Content Researcher (Clustering)',
  story_writer_lead: 'Lead Story Writer',
  story_writer_briefings: 'Briefing Writer',
  story_writer_watch_list: 'Watch List Writer',
  subject_line_generator: 'Subject Line Generator',
};

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<ManagedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('GET', '/prompts').then(d => { setPrompts(d.prompts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function startEdit(prompt: ManagedPrompt) {
    setEditing(prompt.stage); setEditText(prompt.promptText);
  }

  async function savePrompt(stage: string) {
    setSaving(true);
    try {
      await api('PUT', `/prompts/${stage}`, { promptText: editText });
      setPrompts(prev => prev.map(p => p.stage === stage ? { ...p, promptText: editText, isDefault: false } : p));
      setEditing(null);
    } catch (err: any) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }

  async function revertPrompt(stage: string) {
    if (!confirm('Revert to the original system default? Your changes will be lost.')) return;
    try {
      await api('POST', `/prompts/${stage}/revert`);
      const updated = await api('GET', `/prompts/${stage}`);
      setPrompts(prev => prev.map(p => p.stage === stage ? { ...updated } : p));
      setEditing(null);
    } catch (err: any) { alert('Revert failed: ' + err.message); }
  }

  const card = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 };
  const templateVars = ['{{audience}}', '{{newsletterName}}', '{{articleCount}}', '{{currentDate}}', '{{sectionNames}}'];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading prompts...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>Settings</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        View and edit the GPT prompts used at each pipeline stage. Template variables like <code style={{ background: '#f0f0f5', padding: '1px 4px', borderRadius: 3, fontSize: 13 }}>{'{{audience}}'}</code> are replaced with your newsletter's settings at runtime.
      </p>

      {prompts.length === 0 ? (
        <div style={card}><p style={{ color: '#888' }}>No prompts found. Run a pipeline first to seed the default prompts.</p></div>
      ) : (
        prompts.map(p => (
          <div key={p.stage} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{STAGE_LABELS[p.stage] || p.stage}</span>
                {p.isDefault ? (
                  <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>Default</span>
                ) : (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>Modified</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editing !== p.stage && (
                  <button onClick={() => startEdit(p)} style={{ padding: '4px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                )}
                {!p.isDefault && editing !== p.stage && (
                  <button onClick={() => revertPrompt(p.stage)} style={{ padding: '4px 12px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Revert</button>
                )}
              </div>
            </div>

            {editing === p.stage ? (
              <div>
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  style={{ width: '100%', minHeight: 300, padding: 12, border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => savePrompt(p.stage)} disabled={saving}
                    style={{ padding: '6px 16px', background: saving ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} style={{ padding: '6px 16px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <pre style={{ fontSize: 12, color: '#555', background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>
                {p.promptText.substring(0, 500)}{p.promptText.length > 500 ? '...' : ''}
              </pre>
            )}
          </div>
        ))
      )}

      <div style={{ ...card, background: '#f8fafc' }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Template Variables</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>These are automatically replaced with your newsletter's settings when the prompt is sent to GPT:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {templateVars.map(v => (
            <code key={v} style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: 4, fontSize: 12 }}>{v}</code>
          ))}
        </div>
      </div>
    </div>
  );
}
