CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('viewer', 'proposal_manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notify_routing_type AS ENUM ('sme_only', 'pm_only', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE preferred_contact_type AS ENUM ('email', 'teams');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('available', 'limited', 'unavailable');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue');
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

CREATE TABLE IF NOT EXISTS smes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nis_email TEXT,
  federal_email TEXT,
  teams_id TEXT,
  pm_name TEXT,
  pm_email TEXT,
  skillsets TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  contract_title TEXT,
  position TEXT,
  clearance_level TEXT,
  availability_status availability_type NOT NULL DEFAULT 'available',
  ok_to_contact_directly BOOLEAN NOT NULL DEFAULT TRUE,
  notify_routing notify_routing_type NOT NULL DEFAULT 'both',
  preferred_contact preferred_contact_type NOT NULL DEFAULT 'email',
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sme_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  due_date DATE NOT NULL,
  assigned_sme_id UUID REFERENCES smes(id),
  status request_status NOT NULL DEFAULT 'pending',
  response_token TEXT UNIQUE NOT NULL,
  decline_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sme_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES sme_requests(id) ON DELETE CASCADE,
  sme_id UUID REFERENCES smes(id) ON DELETE SET NULL,
  sender TEXT NOT NULL DEFAULT 'smefinder@nw-its.com',
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sme_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES sme_requests(id) ON DELETE CASCADE,
  sme_id UUID REFERENCES smes(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sme_request_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES sme_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_smes_active ON smes(is_active);
CREATE INDEX IF NOT EXISTS idx_smes_clearance ON smes(clearance_level);
CREATE INDEX IF NOT EXISTS idx_smes_availability ON smes(availability_status);
CREATE INDEX IF NOT EXISTS idx_sme_requests_status_due ON sme_requests(status, due_date);
CREATE INDEX IF NOT EXISTS idx_smes_skillsets_gin ON smes USING GIN(skillsets);
CREATE INDEX IF NOT EXISTS idx_sme_tracking_request_created ON sme_request_tracking(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_signins_visit_date ON visitor_signins(visit_date, submitted_at DESC);

INSERT INTO users (email, password_hash, first_name, last_name, role)
SELECT 'admin@smefinder.local', crypt('admin123', gen_salt('bf')), 'System', 'Admin', 'admin'::user_role
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@smefinder.local');
