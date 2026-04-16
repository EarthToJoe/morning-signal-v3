-- Morning Signal V3 — Enable Row-Level Security on all tables
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- 
-- This locks down the Supabase REST API (PostgREST) so that the anon key
-- cannot be used to read or write data directly. Our Express server uses
-- the service_role key which bypasses RLS, so server operations are unaffected.

-- Enable RLS on all user-data tables
ALTER TABLE newsletter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_candidate_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE written_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembled_newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_collections ENABLE ROW LEVEL SECURITY;

-- With RLS enabled and NO policies defined, the default is DENY ALL
-- for the anon and authenticated roles. This means:
-- - The Supabase REST API (anon key) cannot read or write any data
-- - The service_role key (used by our Express server) bypasses RLS entirely
-- - This is the correct setup for a server-side app like ours
--
-- If we later want to allow direct client-to-Supabase queries (e.g., for
-- real-time subscriptions), we'd add policies like:
--
-- CREATE POLICY "Users can read own profiles" ON newsletter_profiles
--   FOR SELECT USING (user_id = auth.uid());
--
-- But for now, all data access goes through our Express API, so no
-- policies are needed — just RLS enabled to block the public API.
