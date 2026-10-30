-- QuickReply billing schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS invoices (
  id           TEXT PRIMARY KEY,
  install_id   TEXT NOT NULL,
  plan         TEXT NOT NULL,
  seats        INTEGER NOT NULL,
  currency     TEXT NOT NULL CHECK (currency IN ('USDT', 'TON')),
  amount       TEXT NOT NULL,          -- base units (micro-USDT / nanoton)
  usd_cents    INTEGER NOT NULL,
  comment      TEXT NOT NULL UNIQUE,   -- payment reference the payer must include
  pay_to       TEXT NOT NULL,          -- raw address
  status       TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired')),
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  paid_at      INTEGER,
  event_id     TEXT,
  sender       TEXT,
  license_key  TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_install ON invoices (install_id, created_at);

-- Every on-chain event that paid an invoice. PRIMARY KEY makes double-counting impossible.
CREATE TABLE IF NOT EXISTS payments (
  event_id    TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL,
  currency    TEXT NOT NULL,
  amount      TEXT NOT NULL,
  sender      TEXT,
  lt          TEXT NOT NULL,
  paid_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  license_key  TEXT PRIMARY KEY,
  tier         TEXT NOT NULL CHECK (tier IN ('pro', 'business')),
  plan         TEXT NOT NULL,
  seats        INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Which installs (browsers) use a license. Limited to plan devices × seats.
CREATE TABLE IF NOT EXISTS activations (
  license_key   TEXT NOT NULL,
  install_id    TEXT NOT NULL,
  activated_at  INTEGER NOT NULL,
  PRIMARY KEY (license_key, install_id)
);
CREATE INDEX IF NOT EXISTS idx_activations_install ON activations (install_id);

CREATE TABLE IF NOT EXISTS state (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL
);
