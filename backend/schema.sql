CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password_salt TEXT,
  password_hash TEXT,
  token_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS parent_sessions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_token_hash TEXT,
  device_name TEXT,
  paired_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS pairing_sessions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  passkey_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters DOUBLE PRECISION NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS location_pings (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  altitude_meters DOUBLE PRECISION,
  speed_meters_per_second DOUBLE PRECISION,
  bearing_degrees DOUBLE PRECISION,
  provider TEXT,
  captured_at BIGINT,
  received_at BIGINT NOT NULL,
  device TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  purchase_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  verified_at BIGINT NOT NULL,
  expires_at BIGINT
);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  email TEXT,
  status TEXT NOT NULL,
  requested_at BIGINT NOT NULL,
  completed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairing_sessions(code);
CREATE INDEX IF NOT EXISTS idx_location_child_received ON location_pings(child_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_parent ON places(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_sessions_token ON parent_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_parent_email ON parents(email);

ALTER TABLE parents ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS password_salt TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS deleted_at BIGINT;
