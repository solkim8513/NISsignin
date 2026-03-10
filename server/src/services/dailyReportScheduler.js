const pool = require('../db/pool');
const { sendDailyVisitorReport } = require('./emailService');

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function parseIntervalMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 15000) return 60000;
  return parsed;
}

function normalizeScheduledTime(value) {
  const normalized = String(value || '').trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) return normalized;
  return '17:00';
}

function safeTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return 'America/New_York';
  }
}

function getDateAndTimeInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(new Date());
  const mapped = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') mapped[part.type] = part.value;
  });
  return {
    date: `${mapped.year}-${mapped.month}-${mapped.day}`,
    time: `${mapped.hour}:${mapped.minute}`
  };
}

async function hasRunForDate(date) {
  const result = await pool.query('SELECT status FROM daily_report_runs WHERE report_date = $1', [date]);
  return result.rowCount > 0;
}

async function saveRun(date, status, detail) {
  await pool.query(
    `INSERT INTO daily_report_runs (report_date, status, detail, processed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (report_date)
     DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail, processed_at = NOW()`,
    [date, status, detail || null]
  );
}

async function runScheduledReport({ date }) {
  const records = await pool.query(
    `SELECT *
     FROM visitor_signins
     WHERE visit_date = $1
     ORDER BY submitted_at ASC`,
    [date]
  );

  const reportResult = await sendDailyVisitorReport({ date, records: records.rows });
  const status = reportResult.sent ? 'sent' : 'skipped';
  const detail = reportResult.sent
    ? `daily report sent (count=${records.rowCount})`
    : (reportResult.reason || 'email skipped');

  await saveRun(date, status, detail);
  console.log(`[daily-report] ${date} -> ${status}: ${detail}`);
}

function startDailyReportScheduler() {
  const enabled = parseBool(process.env.DAILY_REPORT_ENABLED, true);
  if (!enabled) {
    console.log('[daily-report] scheduler disabled by DAILY_REPORT_ENABLED=false');
    return () => {};
  }

  const timezone = safeTimezone(process.env.REPORT_TIMEZONE || 'America/New_York');
  const scheduledTime = normalizeScheduledTime(process.env.DAILY_REPORT_TIME || '17:00');
  const intervalMs = parseIntervalMs(process.env.DAILY_REPORT_CHECK_INTERVAL_MS);

  console.log(`[daily-report] scheduler started at ${scheduledTime} ${timezone} (check every ${intervalMs}ms)`);

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = getDateAndTimeInTimezone(timezone);
      if (now.time < scheduledTime) return;
      if (await hasRunForDate(now.date)) return;
      await runScheduledReport({ date: now.date });
    } catch (error) {
      console.error('[daily-report] scheduler run failed', error);
    } finally {
      running = false;
    }
  };

  const warmup = setTimeout(() => {
    tick().catch(() => {});
  }, 5000);
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, intervalMs);

  return () => {
    clearTimeout(warmup);
    clearInterval(timer);
  };
}

module.exports = { startDailyReportScheduler };
