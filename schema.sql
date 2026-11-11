-- LiveDeck accounts schema (PostgreSQL 13+). Safe to run on every boot (IF NOT EXISTS).

-- Every device that ever started a trial. The trial clock lives here, not on the user,
-- so deleting an account and signing up again from the same device does not reset it.
CREATE TABLE IF NOT EXISTS devices (
  device_id      TEXT PRIMARY KEY,
  platform       TEXT NOT NULL DEFAULT 'desktop',
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE,          -- stored lower-case
  password_hash         TEXT NOT NULL,                 -- bcrypt
  device_id             TEXT NOT NULL REFERENCES devices(device_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscription_status   TEXT NOT NULL DEFAULT 'trial'
                        CHECK (subscription_status IN ('trial', 'active', 'expired', 'canceled')),
  subscription_ends_at  TIMESTAMPTZ,                   -- set by the payment webhook when paid
  last_login_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_device_id_idx ON users (device_id);
