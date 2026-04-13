-- Morning Signal V3 — Schema Migration
-- Extends V2 schema with user_id, source collections, custom sections, images

-- Add user_id to newsletter_profiles (nullable for now since existing rows don't have it)
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'dev-user-id';
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT '';
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS header_image_url TEXT;
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Georgia, ''Times New Roman'', serif';
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}';
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS section_names JSONB DEFAULT '{"lead": "Lead Story", "briefing": "Quick Hits", "watch": "Watch List"}';

-- Add user_id to editions
ALTER TABLE editions ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'dev-user-id';

-- Create source_collections table
CREATE TABLE IF NOT EXISTS source_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES newsletter_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  collection_type TEXT NOT NULL CHECK (collection_type IN ('preferred', 'excluded')),
  domains TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add image columns to written_sections
ALTER TABLE written_sections ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE written_sections ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE written_sections ADD COLUMN IF NOT EXISTS image_cost NUMERIC(10,6) DEFAULT 0;

-- Add design columns to assembled_newsletters
ALTER TABLE assembled_newsletters ADD COLUMN IF NOT EXISTS header_image_url TEXT;
ALTER TABLE assembled_newsletters ADD COLUMN IF NOT EXISTS design_settings JSONB DEFAULT '{}';

-- Add user_id to saved_prompts (nullable — system defaults have NULL)
ALTER TABLE saved_prompts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add profile_id to subscribers if not exists
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES newsletter_profiles(id) ON DELETE CASCADE;

-- Drop old unique constraint on topic_config.category if it exists
-- (allows same category name across different profiles)
ALTER TABLE topic_config DROP CONSTRAINT IF EXISTS topic_config_category_key;

-- Create index for source collections
CREATE INDEX IF NOT EXISTS idx_source_collections_profile ON source_collections(profile_id);
