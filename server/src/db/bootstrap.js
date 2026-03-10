const pool = require('./pool');

async function bootstrapDb() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS visitor_signins (
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
    )`
  );

  await pool.query(
    `ALTER TABLE visitor_signins
       ADD COLUMN IF NOT EXISTS appointment_with TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS clearance_level TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS clearance_level_other TEXT,
       ADD COLUMN IF NOT EXISTS us_citizen TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS id_type TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS id_type_other TEXT,
       ADD COLUMN IF NOT EXISTS time_in TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS time_out TEXT NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS badge_number TEXT NOT NULL DEFAULT ''`
  );

  await pool.query(
    `ALTER TABLE visitor_signins
       ALTER COLUMN email SET DEFAULT '',
       ALTER COLUMN phone SET DEFAULT '',
       ALTER COLUMN purpose_of_visit SET DEFAULT ''`
  );

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_signins_visit_date
     ON visitor_signins(visit_date, submitted_at DESC)`
  );
}

module.exports = { bootstrapDb };
