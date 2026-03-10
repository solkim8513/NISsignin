const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[;,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u2022/g, ';')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getByKeyIncludes(row, candidates) {
  const keys = Object.keys(row || {});
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      const value = cleanText(row[key]);
      if (value) return value;
    }
  }
  return '';
}

function parseYesNo(value, fallback = true) {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return fallback;
}

function parsePreferredContact(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'email';
  return normalized.includes('teams') ? 'teams' : 'email';
}

function splitContractTitleAndPosition(value) {
  if (!value) return { contractTitle: null, position: null };
  const parts = String(value).split(/\s[-—]\s/);
  if (parts.length >= 2) {
    return {
      contractTitle: parts[0].trim() || null,
      position: parts.slice(1).join(' - ').trim() || null
    };
  }
  return { contractTitle: value, position: null };
}

function mapImportRow(rawRow) {
  const name = getByKeyIncludes(rawRow, ['name']);
  if (!name || /^example:/i.test(name) || /^clearancelevels$/i.test(normalizeKey(name))) {
    return null;
  }

  const skillsets = toArray(getByKeyIncludes(rawRow, ['skillset']));
  const certifications = toArray(getByKeyIncludes(rawRow, ['certification']));
  const contractAndPosition = getByKeyIncludes(rawRow, ['contracttitleandposition']);
  const clearance = getByKeyIncludes(rawRow, ['clearancelevel']);
  const okToContact = getByKeyIncludes(rawRow, ['oktocontactdirectly']);
  const preferredMethod = getByKeyIncludes(rawRow, ['preferredmethod']);
  const nisEmail = getByKeyIncludes(rawRow, ['nisemail']);
  const federalEmail = getByKeyIncludes(rawRow, ['federalemail']);
  const teamsId = getByKeyIncludes(rawRow, ['teamsid']);
  const pmName = getByKeyIncludes(rawRow, ['pmname']);
  const pmEmail = getByKeyIncludes(rawRow, ['pmemail']);

  const { contractTitle, position } = splitContractTitleAndPosition(contractAndPosition);

  return {
    name,
    nis_email: nisEmail || null,
    federal_email: federalEmail || null,
    teams_id: teamsId || null,
    pm_name: pmName || null,
    pm_email: pmEmail || null,
    skillsets,
    certifications,
    contract_title: contractTitle,
    position,
    clearance_level: clearance || 'Unknown',
    availability_status: 'available',
    ok_to_contact_directly: parseYesNo(okToContact, true),
    notify_routing: 'both',
    preferred_contact: parsePreferredContact(preferredMethod),
    is_active: true
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { skillset, clearance, availability, search, active = 'true' } = req.query;
    const clauses = [];
    const params = [];

    if (active !== 'all') {
      params.push(active === 'true');
      clauses.push(`is_active = $${params.length}`);
    }
    if (skillset) {
      params.push(String(skillset));
      clauses.push(`$${params.length} = ANY(skillsets)`);
    }
    if (clearance) {
      params.push(String(clearance));
      clauses.push(`clearance_level = $${params.length}`);
    }
    if (availability) {
      params.push(String(availability));
      clauses.push(`availability_status = $${params.length}`);
    }
    if (search) {
      params.push(`%${String(search)}%`);
      clauses.push(`(name ILIKE $${params.length} OR contract_title ILIKE $${params.length} OR position ILIKE $${params.length})`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM smes ${where} ORDER BY name ASC`, params);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const payload = req.body;
    const result = await pool.query(
      `INSERT INTO smes (
        name, nis_email, federal_email, teams_id, pm_name, pm_email,
        skillsets, certifications, contract_title, position, clearance_level,
        availability_status, ok_to_contact_directly, notify_routing,
        preferred_contact, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, COALESCE($16, true)
      ) RETURNING *`,
      [
        payload.name,
        payload.nis_email || null,
        payload.federal_email || null,
        payload.teams_id || null,
        payload.pm_name || null,
        payload.pm_email || null,
        toArray(payload.skillsets),
        toArray(payload.certifications),
        payload.contract_title || null,
        payload.position || null,
        payload.clearance_level || null,
        payload.availability_status || 'available',
        payload.ok_to_contact_directly ?? true,
        payload.notify_routing || 'both',
        payload.preferred_contact || 'email',
        payload.is_active ?? true
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.post('/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true
    });

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const row of records) {
      const mapped = mapImportRow(row);
      if (!mapped) {
        skipped += 1;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO smes (
             name, nis_email, federal_email, teams_id, pm_name, pm_email,
             skillsets, certifications, contract_title, position, clearance_level,
             availability_status, ok_to_contact_directly, notify_routing, preferred_contact, is_active
           ) VALUES (
             $1,$2,$3,$4,$5,$6,
             $7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16
           )`,
          [
            mapped.name,
            mapped.nis_email,
            mapped.federal_email,
            mapped.teams_id,
            mapped.pm_name,
            mapped.pm_email,
            mapped.skillsets,
            mapped.certifications,
            mapped.contract_title,
            mapped.position,
            mapped.clearance_level,
            mapped.availability_status,
            mapped.ok_to_contact_directly,
            mapped.notify_routing,
            mapped.preferred_contact,
            mapped.is_active
          ]
        );
        inserted += 1;
      } catch (error) {
        skipped += 1;
        if (errors.length < 5) {
          errors.push({ name: mapped.name, error: error.message });
        }
      }
    }

    return res.status(201).json({ imported: inserted, skipped, total: records.length, errors });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [sme, ratings, requests] = await Promise.all([
      pool.query('SELECT * FROM smes WHERE id = $1', [req.params.id]),
      pool.query('SELECT * FROM sme_ratings WHERE sme_id = $1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
      pool.query('SELECT * FROM sme_requests WHERE assigned_sme_id = $1 ORDER BY created_at DESC LIMIT 10', [req.params.id])
    ]);

    if (!sme.rows.length) return res.status(404).json({ error: 'SME not found' });
    return res.json({ ...sme.rows[0], ratings: ratings.rows, recent_requests: requests.rows });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireAuth, requireRole('proposal_manager', 'admin'), async (req, res, next) => {
  try {
    const payload = req.body;
    const result = await pool.query(
      `UPDATE smes
       SET name = $2, nis_email = $3, federal_email = $4, teams_id = $5,
           pm_name = $6, pm_email = $7, skillsets = $8, certifications = $9,
           contract_title = $10, position = $11, clearance_level = $12,
           availability_status = $13, ok_to_contact_directly = $14,
           notify_routing = $15, preferred_contact = $16, is_active = $17,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        req.params.id,
        payload.name,
        payload.nis_email || null,
        payload.federal_email || null,
        payload.teams_id || null,
        payload.pm_name || null,
        payload.pm_email || null,
        toArray(payload.skillsets),
        toArray(payload.certifications),
        payload.contract_title || null,
        payload.position || null,
        payload.clearance_level || null,
        payload.availability_status || 'available',
        payload.ok_to_contact_directly ?? true,
        payload.notify_routing || 'both',
        payload.preferred_contact || 'email',
        payload.is_active ?? true
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'SME not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE smes SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'SME not found' });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
