CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('viewer', 'proposal_manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_signins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose_of_visit TEXT NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_signins_visit_date
  ON visitor_signins(visit_date, submitted_at DESC);

INSERT INTO users (email, password_hash, first_name, last_name, role)
SELECT 'admin@nis.local', crypt('admin123', gen_salt('bf')), 'System', 'Admin', 'admin'::user_role
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@nis.local');
