const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { token, action, reason } = req.query;
    if (!token || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid token/action' });
    }

    const existing = await pool.query('SELECT * FROM sme_requests WHERE response_token = $1', [token]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Request not found' });
    const request = existing.rows[0];

    if (!['pending', 'overdue'].includes(request.status)) {
      return res.status(409).json({
        error: 'Request status already changed by proposal team',
        current_status: request.status
      });
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const update = await pool.query(
      `UPDATE sme_requests
       SET status = $2,
           decline_reason = CASE WHEN $2 = 'declined' THEN COALESCE($3, decline_reason, 'Declined via link') ELSE decline_reason END,
           updated_at = NOW()
       WHERE response_token = $1
       RETURNING *`,
      [token, nextStatus, reason || null]
    );

    return res.json({ success: true, status: update.rows[0].status });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
