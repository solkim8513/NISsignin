const express = require('express');
const QRCode = require('qrcode');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendVisitorSigninNotification } = require('../services/emailService');

const router = express.Router();

function normalizeDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : null;
}

router.post('/public', async (req, res, next) => {
  try {
    const { full_name, company, email, phone, purpose_of_visit } = req.body;
    if (!full_name || !company || !email || !phone || !purpose_of_visit) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await pool.query(
      `INSERT INTO visitor_signins (full_name, company, email, phone, purpose_of_visit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, company, email, phone, purpose_of_visit, visit_date, submitted_at`,
      [
        String(full_name).trim(),
        String(company).trim(),
        String(email).trim().toLowerCase(),
        String(phone).trim(),
        String(purpose_of_visit).trim()
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
