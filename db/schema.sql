CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  has_lifetime BOOLEAN NOT NULL DEFAULT FALSE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  adult_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL,
  preference_id TEXT,
  mp_payment_id TEXT,
  fulfilled BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  adult_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_mp_payment_id_unique
  ON purchases (mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS purchases_user_created_idx
  ON purchases (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_consumptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, quote_id)
);
