# Feature Tier Tracking — Morning Signal V3

Track which features are free vs premium for eventual monetization.

## Free Tier
- Create 1 newsletter profile
- Use preset templates
- 2-4 editions per month
- Basic editorial workflow (select → edit → preview)
- Download HTML
- 3 topic categories max
- Standard themes (Professional Dark, Clean Light)

## Premium Tier ($15-25/month)
- Unlimited newsletter profiles
- Unlimited editions
- Up to 6 topic categories per profile
- Quick Create (auto-generate full newsletter)
- Custom search during story selection
- Manual story injection (URL + free text)
- Per-story regeneration with guidance
- All themes + custom color picker
- Custom section names
- AI-generated story images (DALL-E)
- Source collections (preferred/excluded domains)
- Subscriber management + email delivery via SendGrid
- Edition history browsing
- Prompt editing (view/modify GPT prompts)
- Priority processing (faster API calls)
- Export to PDF

## Features to Track API Costs For
Each of these consumes API credits and should be metered:
- Parallel AI search calls (~$0.01/call, 4 calls per edition)
- GPT clustering (~$0.05/call)
- GPT writing — lead story (~$0.04/call)
- GPT writing — quick hits (~$0.05/call)
- GPT writing — watch list (~$0.02/call)
- GPT subject lines (~$0.001/call)
- GPT regeneration (~$0.02-0.05/call)
- DALL-E image generation (~$0.04/image)
- Custom search (~$0.01/call)

## Current Feature Status
- [x] Newsletter profiles + presets
- [x] Full editorial workflow (Phase 1-3)
- [x] Quick Create
- [x] Custom search
- [x] Manual story injection
- [x] Headline editing
- [x] Story regeneration
- [x] Source article URLs
- [x] Subject line selection
- [x] Desktop/mobile preview
- [x] Download/Copy HTML
- [x] Cost tracking per edition
- [x] Parallel search + parallel writing
- [ ] Custom section names in UI
- [ ] Theme picker in Phase 3
- [ ] AI-generated images
- [ ] Source collections UI
- [ ] Subscriber management
- [ ] Email delivery (SendGrid)
- [ ] Edition history sidebar
- [ ] Prompt management UI
- [ ] Authentication (login/register)
- [ ] Per-story quick generation from Phase 1


---

## New Feature Requests (April 12, 2026)

### Image Preview & Control
- User must see the fetched image before it goes into the newsletter
- Option to reject an image and try another source article's image
- Option to remove an image entirely
- Future: DALL-E fallback if no good source image exists
- This is Phase 3 functionality — images should appear as cards the user can approve/reject

### Subscriber Discovery (Public-Facing)
This is a new product surface — not just the publisher dashboard, but a reader-facing experience:
- **Newsletter search/browse** — readers can find newsletters by topic
- **Tags/categories** — publishers tag their newsletters (e.g., "Defense", "Tech", "Finance", "Sports")
- **Newsletter public page** — shows name, description, publisher name/username, frequency, sample edition
- **Subscribe button** — reader enters email to subscribe
- **Publisher profile** — username, bio, list of their newsletters
- **Frequency/periodicity** — publisher sets how often they send (daily, weekly, biweekly, monthly) — visible to subscribers

### Database Changes Needed
- `newsletter_profiles` needs: `tags TEXT[]`, `frequency TEXT`, `is_public BOOLEAN`, `description TEXT`
- New `users` table (or Supabase Auth) needs: `username TEXT`, `display_name TEXT`, `bio TEXT`
- Public API endpoints (no auth required) for browsing/searching newsletters

### Priority Assessment
- Image preview/control: Medium — improves quality, can build now
- Newsletter discovery: Large — this is a whole new product surface (reader-facing). Should be planned carefully.
- Tags/frequency/publisher info: Medium — database + profile form additions
- Public pages: Large — needs a separate public-facing UI, SEO considerations

### Recommendation
Build image preview/control now (it's Phase 3 polish).
Add tags/frequency/publisher info to the profile form now (small additions).
Defer the full public discovery/browse experience to a later phase — it's essentially building a second product (the reader experience) on top of the publisher experience.

---

## Scheduled Newsletter Automation (April 13, 2026)

### Overview
Publishers should be able to set their newsletter to run automatically on a schedule, with control over how much human involvement is needed.

### Three Scheduling Modes
1. **Full Auto** — Pipeline runs on schedule → auto-selects stories → assembles → sends to subscribers. Publisher gets an email notification: "Your newsletter was sent to X subscribers" with a link to view the edition.
2. **Draft & Notify** — Pipeline runs on schedule → generates a draft → pauses. Publisher gets an email: "Your newsletter draft is ready" with a link to review. Publisher chooses which phase to start at:
   - Phase 1 (pick stories from scratch)
   - Phase 2 (edit the AI-written text)
   - Phase 3 (review final newsletter before sending)
3. **Manual** (current default) — Publisher triggers everything themselves. No schedule.

### Database Changes Needed
- `newsletter_profiles` needs: `schedule_frequency TEXT` (daily/weekly/biweekly/monthly/none), `schedule_mode TEXT` (auto_send/draft_notify/manual), `schedule_start_phase INTEGER` (1/2/3), `schedule_day TEXT` (monday/tuesday/etc for weekly), `schedule_time TEXT` (HH:MM UTC), `last_scheduled_run TIMESTAMPTZ`

### Implementation Requirements
- Background job scheduler (node-cron or similar) that checks for profiles due to run
- Reuse existing Quick Create pipeline for full auto mode
- Reuse existing pipeline start + pause for draft & notify mode
- Publisher notification emails via SendGrid (separate from newsletter delivery)
- UI in profile edit page to configure: frequency, mode, start phase, preferred day/time
- Dashboard indicator showing next scheduled run per profile

### Dependencies
- SendGrid must be working first (for both newsletter delivery and publisher notifications)
- Profile edit page must exist (done)

### Priority
High — this is the feature that makes the product "recurring by design" (V3 planning principle #6). Without it, publishers have to manually trigger every edition.

---

## Per-Phase Prompt Transparency (April 13, 2026)

### Overview
Users should be able to see and one-time-edit the exact GPT prompt before each pipeline call, with their variables already filled in.

### How It Works
- Each phase page gets a collapsible "Show Prompt" section
- When expanded, shows the fully-rendered prompt (with `{{audience}}`, `{{newsletterName}}`, etc. already replaced)
- User can edit the prompt text for just this run
- The edit is NOT saved as a new default — it's a one-time override
- This is the "prompt transparency on demand" principle from V3 planning

### Where It Appears
- Phase 1: Before clustering — show the content researcher prompt with article list
- Phase 2: Before writing — show the story writer prompt for each section
- Phase 3: Before subject line generation — show the subject line prompt

### Implementation
- Frontend: collapsible `<details>` section with a textarea, pre-filled with the rendered prompt
- Pass the edited prompt text as `promptOverride` to the pipeline API calls (this parameter already exists)

### Also Needed: Per-User Prompt Scoping
- The `saved_prompts` table has a `user_id` column but the PromptManagerService doesn't use it yet
- Before multi-user deployment, prompt edits in Settings must be scoped to the user
- System defaults (user_id = NULL) should be shared; user overrides should be private

### Dashboard Issue
User reports not seeing new features on the dashboard. This may be a browser cache issue — hard refresh (Cmd+Shift+R) should fix it. Or the Vite dev server may need restarting.
