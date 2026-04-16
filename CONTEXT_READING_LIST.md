# Context Reading List — Morning Signal V3

**Purpose:** When a new AI context begins working on this project, it MUST read these files first to understand the project history, architecture, decisions, and current state. New contexts should also add to this list if they create important new documents.

## Required Reading (read all before starting work)

### Project History & Lessons
1. `morning-signal-v2/LESSONS_LEARNED_V2.md` — What worked in V2, what didn't, what to carry forward. Critical for understanding why things are built the way they are.
2. `morning-signal-v2/V3_PLANNING.md` — V3 product vision, scope boundary, user types, monetization view, critical use cases, and warnings about what NOT to do.

### V3 Spec Files
3. `.kiro/specs/morning-signal-v3/requirements.md` — 29 requirements with acceptance criteria. The source of truth for what V3 must do.
4. `.kiro/specs/morning-signal-v3/design.md` — Architecture, component interfaces, data models, API endpoints, prompt templates. The technical blueprint.
5. `.kiro/specs/morning-signal-v3/tasks.md` — 31 task groups with checkboxes. Track progress here. Tasks marked `*` are optional.

### Feature & Business Tracking
6. `morning-signal-v3/FEATURE_TIERS.md` — Free vs premium feature breakdown, API cost tracking, new feature requests (image preview, subscriber discovery, tags/categories, publisher profiles).

### This File
7. `morning-signal-v3/CONTEXT_READING_LIST.md` — You're reading it. Add new important docs here.

## Key Rules for New Contexts
- **SendGrid sender verified:** `morningsignal4@gmail.com` is verified and ready to send. API key is configured in server `.env`.
- V2 must remain untouched — it's a frozen reference baseline
- The AI pipeline is the core product — build around it, don't replace it
- V2 prompts are tuned IP — extend with template variables, don't rewrite
- "Preserve the fast path" — advanced features should not slow down the default experience
- User is not deeply technical — explain concepts when they come up
- GPT-5.4 is the LLM model (use `max_completion_tokens`, not `max_tokens`)
- Parallel AI endpoint: `https://api.parallel.ai/v1beta/search` with `x-api-key` header
- V3 backend: port 3001, V3 frontend: port 5173, V2: port 3000
- Supabase free tier auto-pauses — may need to re-run migrations after unpause
- SendGrid API key is still `REPLACE_ME` — not yet configured
- Auth is in dev mode (backend allows unauthenticated requests when NODE_ENV=development)
- Git repo initialized at `morning-signal-v3/` (local only, not pushed to GitHub yet)

## Server Environment
- `morning-signal-v3/server/.env` — all API keys and DB config
- `morning-signal-v3/client/.env` — Supabase client keys for Vite

## Architecture Quick Reference
- Monorepo: `client/` (React+Vite), `server/` (Express+TS), `shared/` (types+constants)
- Pipeline: Parallel AI search → GPT-5.4 clustering → user selection → GPT writing → MJML assembly → SendGrid delivery
- 4-phase editorial workflow: Select → Edit → Design → Review & Publish
- Database: Supabase PostgreSQL with 13+ tables
