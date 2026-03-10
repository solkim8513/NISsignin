const pool = require('./pool');

async function bootstrapDb() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS visitor_signins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      purpose_of_visit TEXT NOT NULL,
      visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  );

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_signins_visit_date
     ON visitor_signins(visit_date, submitted_at DESC)`
  );
}

module.exports = { bootstrapDb };
