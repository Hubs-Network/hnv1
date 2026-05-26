-- ═══════════════════════════════════════════════════════════════════════
-- Example: Add a wallet owner to a hub
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO profile_admins (profile_id, profile_type, wallet_address, role)
VALUES (
  'stone-oven-house-rora',
  'hub',
  lower('0x45b13d860c56cd3be43a776433b3b7564461b70a'),
  'owner'
)
ON CONFLICT (profile_id, profile_type, wallet_address)
DO UPDATE SET role = EXCLUDED.role;

-- Add another wallet admin (non-owner)
INSERT INTO profile_admins (profile_id, profile_type, wallet_address, role)
VALUES (
  'stone-oven-house-rora',
  'hub',
  lower('0x1234567890abcdef1234567890abcdef12345678'),
  'admin'
)
ON CONFLICT (profile_id, profile_type, wallet_address)
DO UPDATE SET role = EXCLUDED.role;

-- ═══════════════════════════════════════════════════════════════════════
-- TODO: Future Holons integration
-- When ready, create a profile_access table with subject_type support:
--   subject_type = 'integration'
--   subject_id = 'holons:stone-oven-house-rora'
--   provider = 'holons'
--   permissions = '{"edit_profile": true}'::jsonb
-- ═══════════════════════════════════════════════════════════════════════
