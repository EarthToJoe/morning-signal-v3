# Deploying Morning Signal V3 to hughesnode.com

## How It Works
- Your code lives on GitHub
- Railway pulls the code, builds it, and runs it on a server in the cloud
- hughesnode.com points to that Railway server via DNS
- Multiple users can use it simultaneously — each has their own Supabase account
- The database (Supabase) and email (SendGrid) are separate services that the server talks to

## Step 1: Push to GitHub

In your terminal, from the `morning-signal-v3/` folder:

```bash
git add -A
git commit -m "V3 production ready"
git remote add origin https://github.com/EarthToJoe/morning-signal-v3.git
git push -u origin main
```

(Create the repo on GitHub first at github.com/new if it doesn't exist)

## Step 2: Set Up Railway

1. Go to https://railway.app and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the `morning-signal-v3` repository
4. Railway will auto-detect the build config from `railway.json`

## Step 3: Configure Environment Variables

In Railway, go to your project → Variables tab. Add ALL of these:

```
NODE_ENV=production
PORT=3001

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here

# Parallel AI
PARALLEL_AI_API_KEY=your-parallel-ai-key-here

# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=morningsignal4@gmail.com
SENDGRID_FROM_NAME=Morning Signal

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Database
DB_HOST=db.your-project.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_SSL=true

# LLM Models
LLM_MODEL_RESEARCHER=gpt-5.4
LLM_MODEL_WRITER_LEAD=gpt-5.4
LLM_MODEL_WRITER_BRIEFINGS=gpt-5.4
LLM_MODEL_SUBJECT_LINE=gpt-5.4

# Cost
COST_BUDGET_PER_EDITION=1.00

# Newsletter
DEFAULT_NEWSLETTER_NAME=Morning Signal
UNSUBSCRIBE_URL=https://hughesnode.com/unsubscribe
PHYSICAL_ADDRESS=Washington, DC
```

## Step 4: Add Client Environment Variables

Railway also needs the Vite env vars for the client build. Add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Step 5: Point hughesnode.com to Railway

1. In Railway, go to Settings → Networking → Custom Domain
2. Add `hughesnode.com`
3. Railway will give you a CNAME record value
4. Go to your domain registrar (wherever you bought hughesnode.com)
5. Add a CNAME record: `@` or `www` → the Railway value
6. Wait for DNS propagation (usually 5-30 minutes)

## Step 6: Configure Supabase for Production

In Supabase dashboard → Authentication → URL Configuration:
- Set Site URL to `https://hughesnode.com`
- Add `https://hughesnode.com` to Redirect URLs

This ensures email confirmation links redirect to your live site.

## Updating After Deployment

To push updates:
```bash
git add -A
git commit -m "description of changes"
git push
```
Railway auto-deploys on every push to main.
