const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createResponseToken } = require('../services/tokenService');
const { notifySme } = require('../services/notifyService');

const router = express.Router();
const stopWords = new Set(['and', 'with', 'for', 'the', 'from', 'that', 'need', 'needed', 'help', 'support']);

function tokenizeTopic(topic) {
  return String(topic || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));
}

function scoreSme(topicTokens, skillsets) {
  const skills = (skillsets || []).map((s) => String(s).toLowerCase());
  return topicTokens.filter((t) => skills.some((s) => s.includes(t) || t.includes(s))).length;
}

function buildSuggestion(topicTokens, sme) {
  const skills = (sme.skillsets || []).map((s) => String(s).toLowerCase());
  const certs = (sme.certifications || []).map((s) => String(s).toLowerCase());
  const title = `${sme.contract_title || ''} ${sme.position || ''}`.toLowerCase();
  const clearance = String(sme.clearance_level || '').toLowerCase();

  let score = 0;
  const reasons = [];
  const addReason = (text) => {
    if (!reasons.includes(text)) reasons.push(text);
  };

  for (const token of topicTokens) {
    const matchedSkill = skills.find((s) => {
      const words = s.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      return s.includes(token) || words.includes(token);
    });
    if (matchedSkill) {
      score += 6;
      addReason(`Strong skill match on "${matchedSkill}"`);
      continue;
    }

    const matchedCert = certs.find((c) => {
      const words = c.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      return c.includes(token) || words.includes(token);
    });
    if (matchedCert) {
      score += 4;
      addReason(`Related certification: "${matchedCert}"`);
      continue;
    }

    if (title.includes(token)) {
      score += 3;
      addReason(`Relevant contract/position context for "${token}"`);
    }
  }

  const clearanceMentioned = topicTokens.find((t) => ['public', 'secret', 'top', 'sci', 'trust'].includes(t));
  if (clearanceMentioned && clearance.includes(clearanceMentioned)) {
    score += 2;
    addReason(`Clearance alignment: ${sme.clearance_level || 'Unknown'}`);
  }

  if (sme.availability_status === 'available') {
    score += 2;
    addReason('Currently available');
  } else if (sme.availability_status === 'limited') {
    score += 1;
    addReason('Limited availability');
  }

  const rating = Number(sme.avg_rating || 0);
  if (rating > 0) {
    score += Math.min(2, rating / 2);
    addReason(`Performance rating ${rating.toFixed(1)}/5`);
  }

  return {
    id: sme.id,
    name: sme.name,
    score: Number(score.toFixed(2)),
    reason: reasons.slice(0, 3).join(' | ') || 'Closest available profile match',
    clearance_level: sme.clearance_level,
    availability_status: sme.availability_status,
    skillsets: sme.skillsets || []
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(String(status));
      where = `WHERE r.status = $1`;
    }

    const result = await pool.query(
      `SELECT r.*, s.name AS assigned_sme_name
       FROM sme_requests r
       LEFT JOIN smes s ON s.id = r.assigned_sme_id
       ${where}
       ORDER BY r.due_date ASC, r.created_at DESC`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const { opportunity_name, topic, due_date, assigned_sme_id, notes } = req.body;
    const responseToken = createResponseToken();

    const insert = await pool.query(
      `INSERT INTO sme_requests (opportunity_name, topic, due_date, assigned_sme_id, status, response_token, notes, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING *`,
      [opportunity_name, topic, due_date, assigned_sme_id || null, responseToken, notes || null, req.user.id]
    );

    const request = insert.rows[0];

    if (notes && String(notes).trim()) {
      await pool.query(
        `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [request.id, 'proposal_note', String(notes).trim(), req.user.id]
      );
    }

    if (assigned_sme_id) {
      const sme = await pool.query('SELECT * FROM smes WHERE id = $1 AND is_active = true', [assigned_sme_id]);
      if (sme.rows.length) {
        await notifySme({ request, sme: sme.rows[0] });
      }
    }

    return res.status(201).json(request);
  } catch (error) {
    return next(error);
  }
});

router.get('/suggestions', requireAuth, async (req, res, next) => {
  try {
    const topic = String(req.query.topic || '');
    if (!topic.trim()) {
      return res.json({ suggestions: [] });
    }

    const tokens = tokenizeTopic(topic);
    if (!tokens.length) {
      return res.json({ suggestions: [] });
    }

    const smes = await pool.query(
      `SELECT id, name, skillsets, certifications, contract_title, position, clearance_level, availability_status, avg_rating
       FROM smes
       WHERE is_active = true
       ORDER BY avg_rating DESC, name ASC`
    );

    const suggestions = smes.rows
      .map((sme) => buildSuggestion(tokens, sme))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const {
      status,
      decline_reason,
      notes,
      due_date,
      assigned_sme_id,
      opportunity_name,
      topic
    } = req.body;
    const previous = await pool.query('SELECT * FROM sme_requests WHERE id = $1', [req.params.id]);
    if (!previous.rows.length) return res.status(404).json({ error: 'Request not found' });

    const canEditCoreFields = req.user.role === 'admin';
    const nextOpportunityName = canEditCoreFields ? opportunity_name || null : null;
    const nextTopic = canEditCoreFields ? topic || null : null;

    const result = await pool.query(
      `UPDATE sme_requests
       SET opportunity_name = COALESCE($2, opportunity_name),
           topic = COALESCE($3, topic),
           status = COALESCE($4, status),
           decline_reason = COALESCE($5, decline_reason),
           notes = COALESCE($6, notes),
           due_date = COALESCE($7, due_date),
           assigned_sme_id = COALESCE($8, assigned_sme_id),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        req.params.id,
        nextOpportunityName,
        nextTopic,
        status || null,
        decline_reason || null,
        notes || null,
        due_date || null,
        assigned_sme_id || null
      ]
    );

    const updated = result.rows[0];
    const changeNotes = [];

    if (status && previous.rows[0].status !== status) {
      changeNotes.push(`Status changed: ${previous.rows[0].status} -> ${status}`);
    }

    if (canEditCoreFields && opportunity_name && previous.rows[0].opportunity_name !== opportunity_name) {
      changeNotes.push(`Opportunity name changed: "${previous.rows[0].opportunity_name}" -> "${opportunity_name}"`);
    }

    if (canEditCoreFields && topic && previous.rows[0].topic !== topic) {
      changeNotes.push('Topic/area updated by admin');
    }

    if (due_date && String(previous.rows[0].due_date).slice(0, 10) !== String(due_date).slice(0, 10)) {
      changeNotes.push(`Due date changed: ${String(previous.rows[0].due_date).slice(0, 10)} -> ${String(due_date).slice(0, 10)}`);
    }

    if (assigned_sme_id && previous.rows[0].assigned_sme_id !== assigned_sme_id) {
      changeNotes.push('Assigned SME updated');
    }

    if (changeNotes.length) {
      await pool.query(
        `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [updated.id, 'admin_edit', changeNotes.join(' | '), req.user.id]
      );
    }

    if (notes && String(notes).trim()) {
      await pool.query(
        `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [updated.id, 'proposal_note', String(notes).trim(), req.user.id]
      );
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reassign', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { assigned_sme_id, note } = req.body;
    if (!assigned_sme_id) {
      return res.status(400).json({ error: 'assigned_sme_id is required' });
    }

    const [requestResult, smeResult] = await Promise.all([
      pool.query('SELECT * FROM sme_requests WHERE id = $1', [req.params.id]),
      pool.query('SELECT * FROM smes WHERE id = $1 AND is_active = true', [assigned_sme_id])
    ]);

    if (!requestResult.rows.length) return res.status(404).json({ error: 'Request not found' });
    if (!smeResult.rows.length) return res.status(404).json({ error: 'SME not found or inactive' });

    const updated = await pool.query(
      `UPDATE sme_requests
       SET assigned_sme_id = $2,
           status = 'pending',
           decline_reason = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, assigned_sme_id]
    );

    const request = updated.rows[0];
    const sme = smeResult.rows[0];
    await notifySme({ request, sme });

    const reassignmentNote = `Reassigned request to ${sme.name} by admin`;
    await pool.query(
      `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
       VALUES ($1, $2, $3, $4)`,
      [request.id, 'reassignment', reassignmentNote, req.user.id]
    );

    if (note && String(note).trim()) {
      await pool.query(
        `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [request.id, 'proposal_note', String(note).trim(), req.user.id]
      );
    }

    return res.json({ success: true, request });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/tracking', requireAuth, async (req, res, next) => {
  try {
    const [requestResult, notesResult, notificationsResult] = await Promise.all([
      pool.query(
        `SELECT r.*, s.name AS assigned_sme_name
         FROM sme_requests r
         LEFT JOIN smes s ON s.id = r.assigned_sme_id
         WHERE r.id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT t.*, COALESCE(u.first_name || ' ' || u.last_name, u.email, 'System') AS created_by_name
         FROM sme_request_tracking t
         LEFT JOIN users u ON u.id = t.created_by
         WHERE t.request_id = $1
         ORDER BY t.created_at DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT id, sender, channel, recipient, subject, body, status, sent_at
         FROM sme_notifications
         WHERE request_id = $1
         ORDER BY sent_at DESC`,
        [req.params.id]
      )
    ]);

    if (!requestResult.rows.length) return res.status(404).json({ error: 'Request not found' });

    return res.json({
      request: requestResult.rows[0],
      tracking: notesResult.rows,
      notifications: notificationsResult.rows
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/tracking-notes', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const { event_type = 'proposal_note', note } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const validTypes = new Set([
      'proposal_note',
      'reach_out_attempt',
      'email_exchange',
      'teams_exchange',
      'status_change',
      'admin_edit',
      'reassignment'
    ]);
    const type = validTypes.has(event_type) ? event_type : 'proposal_note';

    const existing = await pool.query('SELECT id FROM sme_requests WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Request not found' });

    const inserted = await pool.query(
      `INSERT INTO sme_request_tracking (request_id, event_type, note, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, type, String(note).trim(), req.user.id]
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reassign-suggestion', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const { apply = false } = req.body;
    const requestResult = await pool.query('SELECT * FROM sme_requests WHERE id = $1', [req.params.id]);
    if (!requestResult.rows.length) return res.status(404).json({ error: 'Request not found' });

    const request = requestResult.rows[0];
    const topicTokens = tokenizeTopic(request.topic);

    const smesResult = await pool.query(
      `SELECT * FROM smes
       WHERE is_active = true
         AND availability_status != 'unavailable'
         AND (id IS DISTINCT FROM $1)
       ORDER BY avg_rating DESC, name ASC`,
      [request.assigned_sme_id]
    );

    const candidates = smesResult.rows
      .map((s) => ({ sme: s, score: scoreSme(topicTokens, s.skillsets) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.sme.avg_rating) - Number(a.sme.avg_rating));

    if (!candidates.length) {
      return res.json({ suggestion: null, reason: 'No skill match found' });
    }

    const best = candidates[0].sme;

    if (apply) {
      const updated = await pool.query(
        `UPDATE sme_requests
         SET assigned_sme_id = $2, status = 'pending', decline_reason = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [request.id, best.id]
      );
      await notifySme({ request: updated.rows[0], sme: best });
      return res.json({ applied: true, request: updated.rows[0], suggestion: best });
    }

    return res.json({ applied: false, suggestion: best });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
