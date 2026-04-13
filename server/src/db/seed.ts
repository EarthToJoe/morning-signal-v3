import { pool } from '../config/database';
import { logger } from '../utils/logger';

async function seed() {
  logger.info('Seeding V3 database...', { component: 'db-seed' });
  try {
    // Create Morning Signal profile
    const profileResult = await pool.query(
      `INSERT INTO newsletter_profiles (name, audience, user_id, is_preset, section_names)
       VALUES ($1, $2, $3, true, $4) RETURNING id`,
      ['The Morning Signal', 'Senior government, military, and industry decision-makers in defense, energy, and technology sectors',
       'dev-user-id', JSON.stringify({ lead: 'Lead Story', briefing: 'Quick Hits', watch: 'Watch List' })]
    );
    const profileId = profileResult.rows[0].id;

    // Seed topic configs
    const topics = [
      { cat: 'defense', name: 'Defense & National Security', obj: 'U.S. and allied defense developments including military contracts, weapons programs, Pentagon policy, NATO operations, defense industry news, and military technology.', queries: ['US defense policy', 'Pentagon military', 'NATO defense', 'defense technology contracts'] },
      { cat: 'energy', name: 'Energy & Infrastructure', obj: 'Energy sector developments including oil & gas markets, renewable energy projects, grid infrastructure, nuclear energy policy, and energy technology.', queries: ['energy policy regulation', 'nuclear energy developments', 'renewable energy infrastructure', 'oil gas geopolitics'] },
      { cat: 'technology', name: 'Technology & Innovation', obj: 'Technology developments including cybersecurity, AI policy, cloud computing, semiconductor supply chain, space technology, and federal IT modernization.', queries: ['AI artificial intelligence policy', 'cybersecurity threats', 'semiconductor chip industry', 'space technology defense'] },
      { cat: 'policy', name: 'Policy & Geopolitics', obj: 'U.S. government policy affecting defense, energy, and technology sectors including executive orders, legislation, regulatory actions, and budget decisions.', queries: ['US foreign policy', 'congressional defense legislation', 'geopolitical tensions', 'trade policy national security'] },
    ];

    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      await pool.query(
        `INSERT INTO topic_config (category, display_name, search_queries, objective, priority, is_active, profile_id)
         VALUES ($1, $2, $3::jsonb, $4, $5, true, $6)`,
        [t.cat, t.name, JSON.stringify(t.queries), t.obj, i + 1, profileId]
      );
    }

    // Seed default prompts
    const prompts = [
      { stage: 'content_researcher', text: `You are an editorial researcher for a professional newsletter.\n\nTASK: Analyze the following {{articleCount}} articles and cluster them into 8-15 Story_Candidates for the editor to review.\n\nARTICLES:\n{{#each articles}}\n[{{@index}}] "{{title}}" — {{source}} ({{publishedAt}})\n  URL: {{url}}\n  Category: {{category}}\n  Snippet: {{snippet}}\n{{/each}}\n\nINSTRUCTIONS:\n1. Group related articles about the same topic/development into a single Story_Candidate\n2. Each Story_Candidate must reference at least one article by index number\n3. Suggest ONE Story_Candidate as the Lead_Story (most timely and relevant to the audience)\n4. Classify remaining candidates as "quick_hit" or "watch_list"\n5. Write a brief narrative summary (2-3 sentences) for each candidate\n6. Flag any articles you consider low-relevance in the lowRelevanceArticles array\n7. Articles are already ranked by relevance from the search API\n8. If an article does not naturally cluster with others, present it as its own single-source candidate. Aim for the higher end of 8-15.\n\nTODAY'S DATE: {{currentDate}}\n\nOUTPUT FORMAT (strict JSON):\n{\n  "storyCandidates": [\n    {\n      "headline": "string",\n      "suggestedRole": "lead_story" | "quick_hit" | "watch_list",\n      "narrativeSummary": "string",\n      "sourceArticleIndices": [0, 3, 7],\n      "category": "string"\n    }\n  ],\n  "lowRelevanceArticles": [\n    { "index": 5, "reason": "string" }\n  ]\n}` },
      { stage: 'story_writer_lead', text: `You are the lead writer for a professional newsletter.\n\nTASK: Write the lead story for today's edition.\n\nSTORY CANDIDATE:\nHeadline: {{candidate.headline}}\nSummary: {{candidate.narrativeSummary}}\n\nSOURCE ARTICLES:\n{{#each sourceArticles}}\n[{{@index}}] "{{title}}" — {{source}} ({{publishedAt}})\n  URL: {{url}}\n  Snippet: {{snippet}}\n{{/each}}\n\nREQUIREMENTS:\n- MINIMUM 400 words, target 500 words. DO NOT write fewer than 400 words.\n- Open with a compelling hook\n- Include specific details: names, numbers, dates, organizations\n- Provide context: what happened, who is involved, and what led to this\n- Include a "Why This Matters" paragraph\n- Include inline hyperlinks to source articles using HTML <a> tags\n- At least two source attributions with hyperlinks\n- Professional but engaging tone\n- Do NOT fabricate facts\n\nOUTPUT FORMAT (strict JSON):\n{\n  "headline": "string",\n  "htmlContent": "string",\n  "plainTextContent": "string",\n  "sourceLinks": [{ "url": "string", "anchorText": "string" }]\n}` },
      { stage: 'story_writer_briefings', text: 'Briefings prompt — built inline in story-writer.ts' },
      { stage: 'story_writer_watch_list', text: 'Watch list prompt — built inline in story-writer.ts' },
      { stage: 'subject_line_generator', text: `Generate 3 email subject line options for today's newsletter edition.\n\nLEAD STORY: {{leadStory.headline}}\nFirst line: {{leadStory.firstSentence}}\n\nOTHER HEADLINES:\n{{#each quickHitHeadlines}}\n- {{this}}\n{{/each}}\n\nRULES:\n- Maximum 50 characters per subject line\n- Reference the lead story or most newsworthy item\n- No clickbait, no hyperbole, no ALL-CAPS words\n- Professional tone that drives opens\n- Each option should take a different angle\n\nOUTPUT FORMAT (strict JSON):\n{\n  "subjectLines": ["string", "string", "string"]\n}` },
    ];

    for (const p of prompts) {
      await pool.query(
        'INSERT INTO saved_prompts (stage, prompt_text, is_system_default) VALUES ($1, $2, true) ON CONFLICT (stage) DO NOTHING',
        [p.stage, p.text]
      );
    }

    logger.info('V3 seeding completed', { component: 'db-seed', profileId });
  } catch (error: any) {
    logger.error('Seeding failed', { component: 'db-seed', error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
