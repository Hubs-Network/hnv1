-- Example: Add an admin to a hub profile
-- Replace the values with your actual data.

INSERT INTO profile_admins (
  profile_id,
  profile_type,
  wallet_address,
  role
) VALUES (
  'stone-oven-house-rora',
  'hub',
  lower('0x45b13d860c56cd3be43a776433b3b7564461b70a'),
  'owner'
)
ON CONFLICT (profile_id, profile_type, wallet_address)
DO UPDATE SET role = EXCLUDED.role;

-- Add another admin (non-owner)
INSERT INTO profile_admins (
  profile_id,
  profile_type,
  wallet_address,
  role
) VALUES (
  'stone-oven-house-rora',
  'hub',
  lower('0x1234567890abcdef1234567890abcdef12345678'),
  'admin'
)
ON CONFLICT (profile_id, profile_type, wallet_address)
DO UPDATE SET role = EXCLUDED.role;
