import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Candidate {
  id: string; suggestedRole: string; headline: string; narrativeSummary: string;
  category: string; isManualStory: boolean; sourceArticles: any[]; sourceArticleCount: number;
}
interface Section {
  id: string; role: string; headline: string; htmlContent: string;
  plainTextContent: string; wordCount: number; sourceLinks: any[];
}

const roleColor = (r: string) => r === 'lead_story' ? '#2e7d32' : r === 'quick_hit' ? '#1565c0' : '#e65100';

export default function EditionWorkflow() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const [status, setStatus] = useState('Loading...');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [newsletter, setNewsletter] = useState<any>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [headlineEdits, setHeadlineEdits] = useState<Record<string, string>>({});
  const [sectionNames, setSectionNames] = useState({ lead: 'Lead Story', briefing: 'Quick Hits', watch: 'Watch List' });
  const roleLabel = (r: string) => r === 'lead_story' ? sectionNames.lead : r === 'quick_hit' ? sectionNames.briefing : sectionNames.watch;
  const [confirming, setConfirming] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [generatingStory, setGeneratingStory] = useState<string | null>(null);
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<string, { headline: string; preview: string }>>({});
  const [assembling, setAssembling] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [fetchingImages, setFetchingImages] = useState(false);
  const [imagePreview, setImagePreview] = useState<Record<string, { selectedUrl: string; options: string[]; headline: string }>>({});
  const [imagesFetched, setImagesFetched] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('professional-dark');
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>({});
  const [showPrompt, setShowPrompt] = useState<string | null>(null);
  const [promptTexts, setPromptTexts] = useState<Record<string, { editable: string; locked: string }>>({});
  const themes: Record<string, { label: string; header: string; accent: string }> = {
    'professional-dark': { label: 'Professional Dark', header: '#0f3460', accent: '#0f3460' },
    'clean-light': { label: 'Clean Light', header: '#2563eb', accent: '#2563eb' },
    'bold-crimson': { label: 'Bold Crimson', header: '#991b1b', accent: '#dc2626' },
    'modern-slate': { label: 'Modern Slate', header: '#334155', accent: '#6366f1' },
    'warm-earth': { label: 'Warm Earth', header: '#78350f', accent: '#92400e' },
  };

  useEffect(() => { pollAndLoad(); }, []);

  async function loadPromptPreview(stage: string) {
    if (promptTexts[stage]) { setShowPrompt(showPrompt === stage ? null : stage); return; }
    try {
      const data = await api('GET', `/prompts/${stage}/preview`);
      setPromptTexts(prev => ({ ...prev, [stage]: { editable: data.editablePart, locked: data.lockedPart } }));
      setShowPrompt(stage);
    } catch { setShowPrompt(stage); }
  }

  async function pollAndLoad() {
    setStatus('Waiting for pipeline...');
    // Load section names from the edition's profile
    try {
      const s = await api('GET', `/pipeline/${correlationId}/status`);
      if (s.sectionNames) setSectionNames(sn => ({ ...sn, ...s.sectionNames }));
      setStatus(s.currentStage);
      if (s.currentStage === 'awaiting_selection') { await loadCandidates(); setPhase(1); return; }
      if (s.currentStage === 'awaiting_review') {
        await loadSections();
        // If newsletter is already assembled, go straight to Phase 3
        try {
          const nl = await api('GET', `/editions/${correlationId}/newsletter`);
          if (nl.html) { setNewsletter(nl); if (nl.selectedSubjectLine) setSelectedSubject(nl.selectedSubjectLine); setPhase(3); startBackgroundImageFetch(); return; }
        } catch {}
        setPhase(2); return;
      }
      if (s.currentStage === 'delivered' || s.currentStage === 'approved') {
        try {
          const nl = await api('GET', `/editions/${correlationId}/newsletter`);
          if (nl.html) { setNewsletter(nl); if (nl.selectedSubjectLine) setSelectedSubject(nl.selectedSubjectLine); setPhase(3); startBackgroundImageFetch(); return; }
        } catch {}
        await loadSections(); setPhase(2); return;
      }
    } catch {}
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const s = await api('GET', `/pipeline/${correlationId}/status`);
        setStatus(s.currentStage);
        if (s.status === 'awaiting_editor') {
          if (s.currentStage === 'awaiting_selection') { await loadCandidates(); setPhase(1); return; }
          if (s.currentStage === 'awaiting_review') { await loadSections(); setPhase(2); return; }
        }
        if (s.status === 'failed') { setStatus('Pipeline failed'); return; }
      } catch {}
    }
  }

  async function loadCandidates() {
    const data = await api('GET', `/editions/${correlationId}/candidates`);
    setCandidates(data.candidates);
    const defaults: Record<string, string> = {};
    data.candidates.forEach((c: Candidate) => { defaults[c.id] = c.suggestedRole; });
    setSelections(defaults);
    setStatus('Select stories');
  }

  async function loadSections() {
    const data = await api('GET', `/editions/${correlationId}/sections`);
    setSections(data.sections);
    setStatus('Edit stories');
  }

  async function loadNewsletter() {
    const data = await api('GET', `/editions/${correlationId}/newsletter`);
    setNewsletter(data);
    if (data.selectedSubjectLine) setSelectedSubject(data.selectedSubjectLine);
    setStatus('Review newsletter');
    // Start fetching images in the background
    startBackgroundImageFetch();
  }

  // Phase 1 actions
  async function runCustomSearch() {
    if (!customQuery.trim()) return;
    setStatus('Running custom search...');
    try {
      const data = await api('POST', `/editions/${correlationId}/custom-search`, { queryText: customQuery });
      setCandidates(data.candidates);
      setCustomQuery('');
      setStatus(`Custom search complete — ${data.searchResult?.newArticles || 0} new articles`);
    } catch (err: any) { alert('Search failed: ' + err.message); }
  }

  async function addManualStory(type: 'url' | 'desc') {
    const body = type === 'url' ? { url: manualUrl } : { description: manualDesc };
    if (type === 'url' && !manualUrl.trim()) return;
    if (type === 'desc' && !manualDesc.trim()) return;
    setStatus(type === 'url' ? 'Fetching article...' : 'Adding story...');
    try {
      const data = await api('POST', `/editions/${correlationId}/manual-story`, body);
      setCandidates(data.candidates);
      if (type === 'url') setManualUrl(''); else setManualDesc('');
      setStatus('Story added');
    } catch (err: any) { alert('Failed: ' + err.message); }
  }

  async function enrichCandidate(candidateId: string) {
    setGeneratingStory(candidateId);
    try {
      const data = await api('POST', `/editions/${correlationId}/enrich-candidate`, { candidateId });
      setCandidates(data.candidates);
      setStatus(`Found ${data.articlesFound} articles — headline and summary updated`);
    } catch (err: any) { alert('Failed: ' + err.message); }
    setGeneratingStory(null);
  }

  async function generateStoryPreview(candidateId: string) {
    setGeneratingStory(candidateId);
    try {
      const role = selections[candidateId] || 'quick_hit';
      const data = await api('POST', `/editions/${correlationId}/write-story`, { candidateId, role });
      if (data.section) {
        setGeneratedPreviews(prev => ({ ...prev, [candidateId]: { headline: data.section.headline, preview: data.section.plainTextContent?.substring(0, 300) || data.section.htmlContent?.replace(/<[^>]*>/g, '').substring(0, 300) || '' } }));
      }
    } catch (err: any) { alert('Generate failed: ' + err.message); }
    setGeneratingStory(null);
  }

  async function confirmSelections() {
    const lead = candidates.find(c => selections[c.id] === 'lead_story');
    const quickHits = candidates.filter(c => selections[c.id] === 'quick_hit');
    const watchList = candidates.filter(c => selections[c.id] === 'watch_list');
    if (!lead) { alert('Select a Lead Story'); return; }
    if (quickHits.length === 0) { alert('Select at least one Quick Hit'); return; }
    const applyEdit = (c: Candidate) => headlineEdits[c.id] ? { ...c, headline: headlineEdits[c.id] } : c;
    setConfirming(true);
    setStatus('Writing stories — this takes about a minute...');
    try {
      await api('POST', `/pipeline/${correlationId}/select`, {
        selections: { leadStory: applyEdit(lead), quickHits: quickHits.map(applyEdit), watchListItems: watchList.map(applyEdit) },
        promptOverrides: Object.keys(promptOverrides).length > 0 ? {
          lead: promptOverrides['story_writer_lead'] ? promptOverrides['story_writer_lead'] + '\n\n' + (promptTexts['story_writer_lead']?.locked || '') : undefined,
          briefings: promptOverrides['story_writer_briefings'] ? promptOverrides['story_writer_briefings'] + '\n\n' + (promptTexts['story_writer_briefings']?.locked || '') : undefined,
          watchList: promptOverrides['story_writer_watch_list'] ? promptOverrides['story_writer_watch_list'] + '\n\n' + (promptTexts['story_writer_watch_list']?.locked || '') : undefined,
        } : undefined,
      });
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await api('GET', `/pipeline/${correlationId}/status`);
        setStatus(`Writing: ${s.currentStage}...`);
        if (s.currentStage === 'awaiting_review') { await loadSections(); setPhase(2); setConfirming(false); return; }
        if (s.status === 'failed') { setStatus('Writing failed'); setConfirming(false); return; }
      }
    } catch (err: any) { alert('Error: ' + err.message); setConfirming(false); }
  }

  function moveSectionUp(sectionId: string) {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx <= 0) return prev;
      // Only move within same role
      const current = prev[idx];
      const above = prev[idx - 1];
      if (current.role !== above.role) return prev;
      const updated = [...prev];
      updated[idx - 1] = current;
      updated[idx] = above;
      return updated;
    });
  }

  function moveSectionDown(sectionId: string) {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const current = prev[idx];
      const below = prev[idx + 1];
      if (current.role !== below.role) return prev;
      const updated = [...prev];
      updated[idx + 1] = current;
      updated[idx] = below;
      return updated;
    });
  }

  // Phase 2 actions
  async function regenerateSection(sectionId: string) {
    setRegenerating(sectionId);
    try {
      const data = await api('POST', `/pipeline/${correlationId}/regenerate`, { sectionId });
      if (data.section) {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, headline: data.section.headline, htmlContent: data.section.htmlContent, plainTextContent: data.section.plainTextContent, wordCount: data.section.wordCount } : s));
      }
      setStatus('Section regenerated');
    } catch (err: any) { alert('Regenerate failed: ' + err.message); }
    setRegenerating(null);
  }

  async function saveEditsAndAssemble() {
    setAssembling(true);
    setStatus('Saving edits...');
    for (const s of sections) {
      const h = (document.getElementById(`edit-h-${s.id}`) as HTMLInputElement)?.value;
      const c = (document.getElementById(`edit-c-${s.id}`) as HTMLTextAreaElement)?.value;
      if (h && c && (h !== s.headline || c !== s.htmlContent)) {
        await api('PUT', `/editions/${correlationId}/sections/${s.id}`, { headline: h, htmlContent: c, plainTextContent: c.replace(/<[^>]*>/g, '') });
      }
    }
    setStatus('Assembling newsletter...');
    await api('POST', `/editions/${correlationId}/reassemble`, {});
    await loadNewsletter();
    setPhase(3);
    setAssembling(false);
  }

  async function fetchStoryImages() {
    if (imagesFetched && Object.keys(imagePreview).length > 0) {
      // Already fetched — just show them
      setShowImages(true);
      return;
    }
    setFetchingImages(true);
    try {
      const data = await api('POST', `/editions/${correlationId}/fetch-images`);
      const previews: Record<string, { selectedUrl: string; options: string[]; headline: string }> = {};
      for (const r of data.results || []) {
        if (r.images && r.images.length > 0) {
          previews[r.sectionId] = { selectedUrl: '', options: r.images, headline: r.headline || '' };
        }
      }
      setImagePreview(previews);
      setImagesFetched(true);
      setStatus(`Found ${data.totalImages} images across ${Object.keys(previews).length} stories`);
    } catch (err: any) { setStatus('Image fetch failed'); }
    setFetchingImages(false);
  }

  // Background pre-fetch when entering Phase 3
  function startBackgroundImageFetch() {
    if (imagesFetched || fetchingImages) return;
    setFetchingImages(true);
    api('POST', `/editions/${correlationId}/fetch-images`).then(data => {
      const previews: Record<string, { selectedUrl: string; options: string[]; headline: string }> = {};
      for (const r of data.results || []) {
        if (r.images && r.images.length > 0) {
          previews[r.sectionId] = { selectedUrl: '', options: r.images, headline: r.headline || '' };
        }
      }
      setImagePreview(previews);
      setImagesFetched(true);
      setFetchingImages(false);
    }).catch(() => { setFetchingImages(false); });
  }

  const [applyingImages, setApplyingImages] = useState(false);
  const [showImages, setShowImages] = useState(false);

  async function approveImages() {
    const selected = Object.entries(imagePreview).filter(([_, img]) => img.selectedUrl);
    if (selected.length === 0) { setStatus('No images selected — click on an image to select it'); return; }
    setApplyingImages(true);
    setStatus(`Applying ${selected.length} image${selected.length !== 1 ? 's' : ''}...`);
    try {
      for (const [sectionId, img] of Object.entries(imagePreview)) {
        if (img.selectedUrl) {
          await api('PUT', `/editions/${correlationId}/sections/${sectionId}`, { imageUrl: img.selectedUrl });
        } else {
          await api('PUT', `/editions/${correlationId}/sections/${sectionId}`, { imageUrl: '' });
        }
      }
      await api('POST', `/editions/${correlationId}/reassemble`, {});
      await loadNewsletter();
      setStatus(`✓ Applied ${selected.length} image${selected.length !== 1 ? 's' : ''} to newsletter — scroll down to preview`);
    } catch (err: any) { alert('Failed to apply images: ' + err.message); setStatus('Image apply failed'); }
    setApplyingImages(false);
  }

  async function applyTheme(themeName: string) {
    setCurrentTheme(themeName);
    try {
      // Map theme name to full theme object
      const themeMap: Record<string, any> = {
        'professional-dark': { headerColor: '#0f3460', accentColor: '#0f3460', backgroundColor: '#f4f4f8', cardColor: '#ffffff', textColor: '#1a1a2e', footerColor: '#1a1a2e' },
        'clean-light': { headerColor: '#2563eb', accentColor: '#2563eb', backgroundColor: '#f8fafc', cardColor: '#ffffff', textColor: '#334155', footerColor: '#1e293b' },
        'bold-crimson': { headerColor: '#991b1b', accentColor: '#dc2626', backgroundColor: '#fef2f2', cardColor: '#ffffff', textColor: '#1f2937', footerColor: '#450a0a' },
        'modern-slate': { headerColor: '#334155', accentColor: '#6366f1', backgroundColor: '#f1f5f9', cardColor: '#ffffff', textColor: '#1e293b', footerColor: '#0f172a' },
        'warm-earth': { headerColor: '#78350f', accentColor: '#92400e', backgroundColor: '#fefce8', cardColor: '#ffffff', textColor: '#422006', footerColor: '#78350f' },
      };
      const theme = themeMap[themeName] || themeMap['professional-dark'];
      const data = await api('POST', `/editions/${correlationId}/reassemble`, { theme });
      setNewsletter((prev: any) => ({ ...prev, html: data.html }));
    } catch (err: any) { alert('Theme failed: ' + err.message); }
  }

  const card = { background: 'white', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const btn = (bg: string, disabled = false) => ({ padding: '8px 16px', background: disabled ? '#94a3b8' : bg, color: 'white', border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' as const : 'pointer' as const, fontSize: 13, fontWeight: 500 as const });
  const input = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };

  const PhaseBar = () => (
    <div style={{ display: 'flex', background: '#e0e0e0', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
      {['Select Stories', 'Edit Stories', 'Newsletter'].map((label, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 8px', fontSize: 13, fontWeight: 500,
          background: phase === i + 1 ? '#0f3460' : phase > i + 1 ? '#2e7d32' : 'transparent',
          color: phase >= i + 1 ? 'white' : '#888' }}>{i + 1}. {label}</div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Edition Workflow</h2>
          <span style={{ fontSize: 13, color: '#888', background: '#f0f0f5', padding: '4px 12px', borderRadius: 12 }}>{status}</span>
        </div>
        {phase > 0 && <PhaseBar />}

        {/* Loading state */}
        {phase === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <p style={{ color: '#888', fontSize: 16 }}>Discovering articles and clustering stories...</p>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>This usually takes about a minute</p>
          </div>
        )}

        {/* PHASE 1 */}
        {phase === 1 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Phase 1: Select Stories</h2>
            <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>Select stories, assign roles, edit headlines. Use custom search or add stories manually.</p>

            {/* Custom search + manual story */}
            <div style={{ ...card, background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={customQuery} onChange={e => setCustomQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runCustomSearch()} placeholder="Custom search query..." style={{ ...input, flex: 1 }} />
                <button onClick={runCustomSearch} style={btn('#2563eb')}>Search</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="Paste article URL..." style={{ ...input, flex: 1 }} />
                <button onClick={() => addManualStory('url')} style={btn('#6366f1')}>Add URL</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Or describe a story topic..." style={{ ...input, flex: 1 }} />
                <button onClick={() => addManualStory('desc')} style={btn('#6366f1')}>Add Topic</button>
              </div>
            </div>

            {/* Candidates */}
            {candidates.map(c => (
              <div key={c.id} style={{ ...card, borderLeft: `3px solid ${roleColor(selections[c.id] || '')}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: roleColor(selections[c.id] || ''), textTransform: 'uppercase' as const, letterSpacing: 1 }}>{roleLabel(selections[c.id] || c.suggestedRole)}</span>
                  {c.isManualStory && <span style={{ fontSize: 10, background: '#fce4ec', color: '#c62828', padding: '1px 6px', borderRadius: 8 }}>Manual</span>}
                  <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{c.category}</span>
                </div>
                <input value={headlineEdits[c.id] ?? c.headline} onChange={e => setHeadlineEdits({ ...headlineEdits, [c.id]: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', border: '1px dashed #ccc', borderRadius: 4, fontSize: 15, fontWeight: 600, background: '#fafafa', marginBottom: 6, boxSizing: 'border-box' as const }} />
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>{c.narrativeSummary}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, color: '#888' }}>{c.sourceArticleCount} source(s)</span>
                    {c.sourceArticles?.filter((a: any) => a.id).length > 0 && (
                      <details style={{ display: 'inline', marginLeft: 8 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#2563eb', display: 'inline' }}>View sources</summary>
                        <div style={{ marginTop: 6, lineHeight: 1.8 }}>
                          {c.sourceArticles.filter((a: any) => a.id).map((a: any, i: number) => (
                            <div key={i}><a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>{a.title || a.source}</a> <span style={{ fontSize: 11, color: '#999' }}>({a.source})</span></div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.sourceArticleCount === 0 ? (
                      <button onClick={() => enrichCandidate(c.id)} disabled={generatingStory === c.id}
                        style={{ padding: '4px 10px', background: generatingStory === c.id ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: generatingStory === c.id ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
                        {generatingStory === c.id ? '⏳ Finding sources...' : '🔍 Find Sources & Generate'}
                      </button>
                    ) : (
                      <button onClick={() => generateStoryPreview(c.id)} disabled={generatingStory === c.id}
                        style={{ padding: '4px 10px', background: generatingStory === c.id ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: generatingStory === c.id ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
                        {generatingStory === c.id ? '⏳ Generating...' : '⚡ Preview Story'}
                      </button>
                    )}
                    <select value={selections[c.id] || ''} onChange={e => setSelections({ ...selections, [c.id]: e.target.value })}
                      style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}>
                      <option value="">— Skip —</option>
                      <option value="lead_story">{sectionNames.lead}</option>
                      <option value="quick_hit">{sectionNames.briefing}</option>
                      <option value="watch_list">{sectionNames.watch}</option>
                    </select>
                  </div>
                </div>
                {generatedPreviews[c.id] && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 4 }}>✅ Generated Preview</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{generatedPreviews[c.id].headline}</div>
                    <p style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>{generatedPreviews[c.id].preview}...</p>
                  </div>
                )}
              </div>
            ))}
            {candidates.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>No candidates found.</p>}
            {/* Prompt transparency */}
            <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>
              <div onClick={() => loadPromptPreview('content_researcher')}
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔍 View/Edit Clustering Prompt</span>
                <span style={{ fontSize: 11, color: '#888' }}>{showPrompt === 'content_researcher' ? '▼' : '▶'}</span>
              </div>
              {showPrompt === 'content_researcher' && (
                <div style={{ padding: '0 16px 12px' }}>
                  <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Edit the instructions below for a one-time override. The output format is locked to keep the pipeline working.</p>
                  <textarea value={promptOverrides['content_researcher'] ?? promptTexts['content_researcher']?.editable ?? ''} onChange={e => setPromptOverrides(prev => ({ ...prev, content_researcher: e.target.value }))}
                    rows={10} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
                  {promptTexts['content_researcher']?.locked && (
                    <pre style={{ fontSize: 11, color: '#888', background: '#f0f0f5', padding: 10, borderRadius: 6, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.4, border: '1px solid #e0e0e0' }}>
                      🔒 {promptTexts['content_researcher'].locked.substring(0, 400)}{promptTexts['content_researcher'].locked.length > 400 ? '...' : ''}
                    </pre>
                  )}
                  {promptOverrides['content_researcher'] && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠️ One-time override active — this won't be saved as your default</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={confirmSelections} disabled={confirming} style={btn(confirming ? '#94a3b8' : '#0f3460', confirming)}>
                {confirming ? '✍️ Writing stories — please wait...' : 'Confirm → Write Stories'}
              </button>
              <button onClick={() => navigate('/dashboard')} style={btn('#94a3b8')}>Cancel</button>
            </div>
          </div>
        )}

        {/* PHASE 2: Story Editing */}
        {phase === 2 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Phase 2: Edit Stories</h2>
            <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>Review and edit each story. Change headlines, edit text, or regenerate.</p>
            {['lead_story', 'quick_hit', 'watch_list'].map(role => {
              const roleSections = sections.filter(s => s.role === role);
              if (roleSections.length === 0) return null;
              return (
                <div key={role}>
                  <h3 style={{ color: roleColor(role), marginBottom: 8, marginTop: 16, fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{roleLabel(role)}</h3>
                  {roleSections.map(s => (
                    <div key={s.id} style={{ ...card, borderLeft: `3px solid ${roleColor(s.role)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: roleColor(s.role) }}>{roleLabel(s.role)}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => moveSectionUp(s.id)} title="Move up" style={{ padding: '2px 6px', background: '#e0e0e0', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>↑</button>
                          <button onClick={() => moveSectionDown(s.id)} title="Move down" style={{ padding: '2px 6px', background: '#e0e0e0', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>↓</button>
                          <button onClick={() => regenerateSection(s.id)} disabled={regenerating === s.id} style={{ ...btn(regenerating === s.id ? '#94a3b8' : '#6366f1', regenerating === s.id), fontSize: 12, padding: '4px 10px' }}>
                            {regenerating === s.id ? 'Regenerating...' : '🔄 Regenerate'}
                          </button>
                        </div>
                      </div>
                      <input id={`edit-h-${s.id}`} defaultValue={s.headline} style={{ ...input, fontWeight: 600, fontSize: 15, marginBottom: 8 }} />
                      <textarea id={`edit-c-${s.id}`} defaultValue={s.htmlContent} rows={s.role === 'lead_story' ? 12 : 6}
                        style={{ ...input, minHeight: 80, resize: 'vertical' as const, lineHeight: 1.6 }} />
                      <span style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>{s.wordCount} words</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Prompt transparency for writing */}
            <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>
              {['story_writer_lead', 'story_writer_briefings', 'story_writer_watch_list'].map(stage => {
                const labels: Record<string, string> = { story_writer_lead: 'Lead Story Writer', story_writer_briefings: 'Briefing Writer', story_writer_watch_list: 'Watch List Writer' };
                return (
                  <div key={stage}>
                    <div onClick={() => loadPromptPreview(stage)}
                      style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                      <span>📝 {labels[stage]} Prompt</span>
                      <span style={{ fontSize: 11, color: '#888' }}>{showPrompt === stage ? '▼' : '▶'}</span>
                    </div>
                    {showPrompt === stage && (
                      <div style={{ padding: '0 16px 12px' }}>
                        <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Edit instructions for this run only. Output format is locked.</p>
                        <textarea value={promptOverrides[stage] ?? promptTexts[stage]?.editable ?? ''} onChange={e => setPromptOverrides(prev => ({ ...prev, [stage]: e.target.value }))}
                          rows={8} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
                        {promptTexts[stage]?.locked && (
                          <pre style={{ fontSize: 11, color: '#888', background: '#f0f0f5', padding: 10, borderRadius: 6, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.4, border: '1px solid #e0e0e0' }}>
                            🔒 {promptTexts[stage].locked.substring(0, 300)}{promptTexts[stage].locked.length > 300 ? '...' : ''}
                          </pre>
                        )}
                        {promptOverrides[stage] && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠️ One-time override active</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={saveEditsAndAssemble} disabled={assembling} style={btn(assembling ? '#94a3b8' : '#0f3460', assembling)}>
                {assembling ? 'Assembling...' : 'Save & Continue → Newsletter'}
              </button>
              <button onClick={() => setPhase(1)} style={btn('#94a3b8')}>← Back to Selection</button>
            </div>
          </div>
        )}

        {/* PHASE 3: Newsletter */}
        {phase === 3 && newsletter && (
          <div>
            <h2 style={{ marginBottom: 16 }}>Phase 3: Newsletter</h2>

            {/* Cost summary */}
            {newsletter.costSummary && (
              <div style={{ display: 'flex', gap: 20, fontSize: 13, padding: '12px 16px', background: '#f0f0f5', borderRadius: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
                <div><span style={{ color: '#888', fontSize: 11 }}>Search</span><br/><strong>${newsletter.costSummary.searchCost?.toFixed(4)}</strong></div>
                <div><span style={{ color: '#888', fontSize: 11 }}>Research</span><br/><strong>${newsletter.costSummary.researchCost?.toFixed(4)}</strong></div>
                <div><span style={{ color: '#888', fontSize: 11 }}>Writing</span><br/><strong>${newsletter.costSummary.writingCost?.toFixed(4)}</strong></div>
                <div><span style={{ color: '#888', fontSize: 11 }}>Total</span><br/><strong style={{ color: newsletter.costSummary.isOverBudget ? '#c62828' : 'inherit' }}>${newsletter.costSummary.totalCost?.toFixed(4)}</strong></div>
                <div><span style={{ color: '#888', fontSize: 11 }}>LLM Calls</span><br/><strong>{newsletter.costSummary.llmCallCount}</strong></div>
              </div>
            )}

            {/* Subject line */}
            <div style={card}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Subject Line</h3>
              {(typeof newsletter.subjectLineOptions === 'string' ? JSON.parse(newsletter.subjectLineOptions) : newsletter.subjectLineOptions || []).map((opt: string, i: number) => (
                <label key={i} onClick={() => setSelectedSubject(opt)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: `1px solid ${selectedSubject === opt ? '#0f3460' : '#ddd'}`, borderRadius: 6, marginBottom: 6, cursor: 'pointer', background: selectedSubject === opt ? '#f0f4ff' : 'white' }}>
                  <input type="radio" name="subject" checked={selectedSubject === opt} onChange={() => setSelectedSubject(opt)} style={{ accentColor: '#0f3460' }} />
                  <span style={{ fontSize: 14 }}>{opt}</span>
                </label>
              ))}
              <input value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} placeholder="Or write a custom subject line..." style={{ ...input, marginTop: 4 }} />
            </div>

            {/* Theme picker */}
            <div style={card}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Theme</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {Object.entries(themes).map(([key, t]) => (
                  <div key={key} onClick={() => applyTheme(key)}
                    style={{ border: `2px solid ${currentTheme === key ? '#0f3460' : '#ddd'}`, borderRadius: 8, padding: 10, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ height: 30, borderRadius: 4, background: `linear-gradient(135deg, ${t.header} 50%, ${t.accent} 50%)`, marginBottom: 6 }} />
                    <span style={{ fontSize: 12 }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div style={card}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Story Images</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Images are pulled from source articles automatically. Click below to pick which ones to include.</p>
              {!showImages ? (
                <button onClick={() => { setShowImages(true); if (!imagesFetched && !fetchingImages) fetchStoryImages(); }}
                  style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  {fetchingImages ? '🔍 Fetching images...' : imagesFetched ? `🖼️ Add Images (${Object.keys(imagePreview).length} found)` : '🖼️ Add Images'}
                </button>
              ) : fetchingImages ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>🔍</div>
                  <p style={{ fontSize: 13 }}>Fetching images from source articles...</p>
                </div>
              ) : null}

              {showImages && imagesFetched && Object.keys(imagePreview).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {Object.entries(imagePreview).map(([sectionId, img]) => (
                    <div key={sectionId} style={{ padding: 12, background: img.selectedUrl ? '#f0fdf4' : '#fafafa', borderRadius: 8, marginBottom: 10, border: `1px solid ${img.selectedUrl ? '#bbf7d0' : '#e0e0e0'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{img.headline}</div>
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {img.options.map((url, i) => (
                          <div key={i} onClick={() => setImagePreview(prev => ({
                            ...prev, [sectionId]: { ...prev[sectionId], selectedUrl: prev[sectionId].selectedUrl === url ? '' : url }
                          }))}
                            style={{ cursor: 'pointer', border: `3px solid ${img.selectedUrl === url ? '#059669' : 'transparent'}`, borderRadius: 8, flexShrink: 0, position: 'relative' as const }}>
                            <img src={url} alt={`Option ${i + 1}`} style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {img.selectedUrl === url && <div style={{ position: 'absolute' as const, top: 4, right: 4, background: '#059669', color: 'white', borderRadius: 10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>}
                          </div>
                        ))}
                      </div>
                      {img.options.length > 1 && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{img.options.length} options — click to select</div>}
                      {img.options.length === 1 && !img.selectedUrl && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Click image to use it</div>}
                    </div>
                  ))}
                  <button onClick={approveImages} disabled={applyingImages}
                    style={{ padding: '8px 16px', background: applyingImages ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: applyingImages ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 }}>
                    {applyingImages ? '⏳ Applying...' : `Apply ${Object.values(imagePreview).filter(i => i.selectedUrl).length} Image${Object.values(imagePreview).filter(i => i.selectedUrl).length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>

            {/* Preview */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15 }}>Preview</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPreviewMode('desktop')} style={{ ...btn(previewMode === 'desktop' ? '#0f3460' : '#e0e0e0'), color: previewMode === 'desktop' ? 'white' : '#333', fontSize: 12 }}>Desktop</button>
                  <button onClick={() => setPreviewMode('mobile')} style={{ ...btn(previewMode === 'mobile' ? '#0f3460' : '#e0e0e0'), color: previewMode === 'mobile' ? 'white' : '#333', fontSize: 12 }}>Mobile</button>
                </div>
              </div>
              <iframe srcDoc={newsletter.html?.replace('<head>', '<head><base target="_blank">')}
                style={{ width: previewMode === 'mobile' ? 375 : '100%', height: 700, border: '1px solid #e0e0e0', borderRadius: 8, margin: '0 auto', display: 'block' }} />
            </div>

            {/* Quick Send */}
            <div style={card}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Send Newsletter</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Enter email addresses to send this newsletter to — no need to add them as subscribers. Separate multiple emails with commas.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="quick-send-emails" placeholder="email@example.com, friend@example.com" style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }} />
                <button onClick={async () => {
                  const input = (document.getElementById('quick-send-emails') as HTMLInputElement)?.value || '';
                  const emails = input.split(',').map(e => e.trim()).filter(e => e.includes('@'));
                  if (emails.length === 0) { alert('Enter at least one email address'); return; }
                  if (!confirm(`Send to ${emails.length} email(s)?`)) return;
                  try {
                    const data = await api('POST', `/editions/${correlationId}/quick-send`, { emails, subjectLine: selectedSubject });
                    alert(`Sent to ${data.sent} of ${data.total} email(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}`);
                  } catch (err: any) { alert('Send failed: ' + err.message); }
                }} style={{ ...btn('#2e7d32'), padding: '10px 20px' }}>✉️ Send</button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' as const }}>
              <button onClick={() => {
                const blob = new Blob([newsletter.html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'newsletter.html'; a.click();
                URL.revokeObjectURL(url);
              }} style={btn('#0f3460')}>📥 Download HTML</button>
              <button onClick={() => { navigator.clipboard.writeText(newsletter.html); alert('HTML copied to clipboard'); }} style={btn('#2563eb')}>📋 Copy HTML</button>
              <button onClick={async () => {
                if (!confirm('Send this newsletter to all active subscribers?')) return;
                try {
                  const data = await api('POST', `/editions/${correlationId}/send`, { subjectLine: selectedSubject });
                  if (data.report) {
                    alert(`Sent to ${data.report.totalSent} subscriber(s). ${data.report.failureCount} failed.`);
                  } else {
                    alert('Newsletter sent.');
                  }
                } catch (err: any) { alert('Send failed: ' + err.message); }
              }} style={btn('#2e7d32')}>✉️ Send to Subscribers</button>
              <button onClick={() => setPhase(2)} style={btn('#94a3b8')}>← Back to Editing</button>
              <button onClick={() => navigate('/dashboard')} style={btn('#94a3b8')}>Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
