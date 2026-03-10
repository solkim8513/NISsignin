const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const [open, overdue, topRated, totalSmes, completedRecent] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM sme_requests WHERE status IN ('pending','accepted','in_progress')`),
      pool.query(`SELECT COUNT(*)::int AS count FROM sme_requests WHERE due_date < CURRENT_DATE AND status != 'completed'`),
      pool.query(`SELECT id, name, avg_rating, skillsets FROM smes WHERE is_active = true ORDER BY avg_rating DESC, name ASC LIMIT 10`),
      pool.query(`SELECT COUNT(*)::int AS count FROM smes WHERE is_active = true`),
      pool.query(`SELECT COUNT(*)::int AS count FROM sme_requests WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '30 days'`)
    ]);

    return res.json({
      total_smes: totalSmes.rows[0].count,
      open_requests: open.rows[0].count,
      overdue_items: overdue.rows[0].count,
      completed_recent: completedRecent.rows[0].count,
      top_rated_smes: topRated.rows
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
