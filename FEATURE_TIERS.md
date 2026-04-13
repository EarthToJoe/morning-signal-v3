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
