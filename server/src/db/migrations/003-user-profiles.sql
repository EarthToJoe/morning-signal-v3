-- User profiles table for display names and metadata
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Anonymous',
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Seed the dev user profile
INSERT INTO user_profiles (user_id, display_name, bio)
VALUES ('dev-user-id', 'IrishPicasso', 'Platform developer')
ON CONFLICT (user_id) DO UPDATE SET display_name = 'IrishPicasso';

-- Add creator_display_name to newsletter_profiles for denormalized display
ALTER TABLE newsletter_profiles ADD COLUMN IF NOT EXISTS creator_display_name TEXT DEFAULT 'Anonymous';

-- Update existing profiles to show IrishPicasso
UPDATE newsletter_profiles SET creator_display_name = 'IrishPicasso' WHERE user_id = 'dev-user-id';

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
