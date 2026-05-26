-- Hubs Network: Private admin registry
-- Run this in the Neon SQL Editor to set up the table.

CREATE TABLE IF NOT EXISTS profile_admins (
  id SERIAL PRIMARY KEY,
  profile_id TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('hub', 'pilgrim')),
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id, profile_type, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_profile_admins_lookup
ON profile_admins (profile_id, profile_type, wallet_address);
