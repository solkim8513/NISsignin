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
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  full_name TEXT NOT NULL,
  company TEXT NOT NULL,
  appointment_with TEXT NOT NULL DEFAULT '',
  clearance_level TEXT NOT NULL DEFAULT '',
  clearance_level_other TEXT,
  us_citizen TEXT NOT NULL DEFAULT '',
  id_type TEXT NOT NULL DEFAULT '',
  id_type_other TEXT,
  time_in TEXT NOT NULL DEFAULT '',
  time_out TEXT NOT NULL DEFAULT '',
  badge_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  purpose_of_visit TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_signins_visit_date
  ON visitor_signins(visit_date, submitted_at DESC);

CREATE TABLE IF NOT EXISTS daily_report_runs (
  report_date DATE PRIMARY KEY,
  status TEXT NOT NULL,
  detail TEXT,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, password_hash, first_name, last_name, role)
SELECT 'admin@nis.local', crypt('admin123', gen_salt('bf')), 'System', 'Admin', 'admin'::user_role
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@nis.local');
