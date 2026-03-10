const express = require('express');
const QRCode = require('qrcode');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendVisitorSigninNotification, sendDailyVisitorReport } = require('../services/emailService');

const router = express.Router();
const TIME_DIGITS_REGEX = /^\d{4}$/;
const NUMERIC_REGEX = /^\d+$/;
const CLEARANCE_OPTIONS = new Set([
  'none',
  'public trust',
  'confidential',
  'secret',
  'top secret',
  'ts/sci',
  'other'
]);
const CITIZEN_OPTIONS = new Set(['yes', 'no']);
const ID_TYPE_OPTIONS = new Set(['state id', 'dl', 'other']);

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : null;
}

router.post('/public', async (req, res, next) => {
  try {
    const visit_date = normalizeDate(req.body.visit_date) || new Date().toISOString().slice(0, 10);
    const full_name = normalizeText(req.body.full_name);
    const company = normalizeText(req.body.company);
    const appointment_with = normalizeText(req.body.appointment_with);
    const clearance_level = normalizeText(req.body.clearance_level).toLowerCase();
    const clearance_level_other = normalizeText(req.body.clearance_level_other);
    const us_citizen = normalizeText(req.body.us_citizen).toLowerCase();
    const id_type = normalizeText(req.body.id_type).toLowerCase();
    const id_type_other = normalizeText(req.body.id_type_other);
    const time_in = normalizeText(req.body.time_in);
    const time_out = normalizeText(req.body.time_out);
    const badge_number = normalizeText(req.body.badge_number);

    if (!full_name || !company || !appointment_with || !clearance_level || !us_citizen || !id_type || !time_in || !badge_number) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!CLEARANCE_OPTIONS.has(clearance_level)) {
      return res.status(400).json({ error: 'Please select a valid clearance level' });
    }
    if (clearance_level === 'other' && !clearance_level_other) {
      return res.status(400).json({ error: 'Please enter a clearance value for Other' });
    }
    if (!CITIZEN_OPTIONS.has(us_citizen)) {
      return res.status(400).json({ error: 'Please select US citizen as Yes or No' });
    }
    if (!ID_TYPE_OPTIONS.has(id_type)) {
      return res.status(400).json({ error: 'Please select a valid ID type' });
    }
    if (id_type === 'other' && !id_type_other) {
      return res.status(400).json({ error: 'Please enter an ID type for Other' });
    }
    if (!TIME_DIGITS_REGEX.test(time_in)) {
      return res.status(400).json({ error: 'Time in must be exactly 4 numbers (HHMM)' });
    }
    if (time_out && !TIME_DIGITS_REGEX.test(time_out)) {
      return res.status(400).json({ error: 'Time out must be exactly 4 numbers (HHMM)' });
    }
    if (!NUMERIC_REGEX.test(badge_number)) {
      return res.status(400).json({ error: 'Badge number must contain numbers only' });
    }

    const result = await pool.query(
      `INSERT INTO visitor_signins (
          visit_date,
          full_name,
          company,
          appointment_with,
          clearance_level,
          clearance_level_other,
          us_citizen,
          id_type,
          id_type_other,
          time_in,
          time_out,
          badge_number
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        visit_date,
        full_name,
        company,
        appointment_with,
        clearance_level,
        clearance_level_other || null,
        us_citizen,
        id_type,
        id_type_other || null,
        time_in,
        time_out || '',
        badge_number
      ]
    );

    const signin = result.rows[0];
    let emailNotification = { sent: false, skipped: true };
    try {
      emailNotification = await sendVisitorSigninNotification(signin);
    } catch (notifyError) {
      console.error('visitor sign-in email notification failed', notifyError);
      emailNotification = { sent: false, skipped: false, error: true };
    }

    return res.status(201).json({ success: true, signin, email_notification: emailNotification });
  } catch (error) {
    return next(error);
  }
});

router.post('/report/daily', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const date = normalizeDate(req.body?.date) || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT *
       FROM visitor_signins
       WHERE visit_date = $1
       ORDER BY submitted_at ASC`,
      [date]
    );

    const reportResult = await sendDailyVisitorReport({ date, records: result.rows });
    return res.json({ success: true, date, count: result.rowCount, report: reportResult });
  } catch (error) {
    return next(error);
  }
});

router.get('/qr', async (req, res, next) => {
  try {
    const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
    const url = req.query.url ? String(req.query.url) : `${baseUrl}/visitor-signin`;
    const imageDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 280 });
    return res.json({ url, image_data_url: imageDataUrl });
  } catch (error) {
    return next(error);
  }
});

router.get('/', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date) || new Date().toISOString().slice(0, 10);
    const rows = await pool.query(
      `SELECT *
       FROM visitor_signins
       WHERE visit_date = $1
       ORDER BY submitted_at DESC`,
      [date]
    );

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM visitor_signins WHERE visit_date = $1', [date]);

    return res.json({ date, total: count.rows[0].count, records: rows.rows });
  } catch (error) {
    return next(error);
  }
});

router.delete('/by-date', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date) || new Date().toISOString().slice(0, 10);
    const result = await pool.query('DELETE FROM visitor_signins WHERE visit_date = $1 RETURNING id', [date]);
    return res.json({ success: true, date, deleted: result.rowCount });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
