-- Pending Safe multisig proposals (threshold > 1)
-- Stores proposed transactions and their confirmations until they can be executed.

CREATE TABLE IF NOT EXISTS safe_proposals (
  id SERIAL PRIMARY KEY,
  safe_address TEXT NOT NULL,
  hub_id TEXT NOT NULL,
  -- Transaction details
  to_address TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  data TEXT NOT NULL,
  operation INTEGER NOT NULL DEFAULT 0,
  safe_tx_gas TEXT NOT NULL DEFAULT '0',
  base_gas TEXT NOT NULL DEFAULT '0',
  gas_price TEXT NOT NULL DEFAULT '0',
  gas_token TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  refund_receiver TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  nonce INTEGER NOT NULL,
  -- Metadata
  safe_tx_hash TEXT NOT NULL UNIQUE,
  description TEXT,
  proposer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
  threshold INTEGER NOT NULL DEFAULT 2,
  tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS safe_confirmations (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES safe_proposals(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(proposal_id, owner_address)
);

CREATE INDEX IF NOT EXISTS idx_safe_proposals_safe ON safe_proposals (safe_address, status);
CREATE INDEX IF NOT EXISTS idx_safe_proposals_hub ON safe_proposals (hub_id, status);
CREATE INDEX IF NOT EXISTS idx_safe_confirmations_proposal ON safe_confirmations (proposal_id);
