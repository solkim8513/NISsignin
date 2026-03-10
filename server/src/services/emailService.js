const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

let cachedTransporter = null;

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  };
}

function isSmtpConfigured(config) {
  return Boolean(config.host && config.user && config.pass);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const config = getSmtpConfig();
  if (!isSmtpConfigured(config)) return null;

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  return cachedTransporter;
}

function buildDailyReportPdf({ date, records }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('NIS Daily Visitor Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Date: ${date}`);
    doc.text(`Total Visitors: ${records.length}`);
    doc.moveDown(1);

    if (!records.length) {
      doc.fontSize(11).text('No visitor records for this date.');
      doc.end();
      return;
    }

    doc.fontSize(9).text('Time | Name | Company | Appointment | Clearance | US Citizen | ID Type | Time In | Time Out | Badge #');
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke();
    doc.moveDown(0.4);

    records.forEach((record, index) => {
      const rowText = [
        new Date(record.submitted_at).toLocaleTimeString(),
        record.full_name || '',
        record.company || '',
        record.appointment_with || '',
        record.clearance_level || '',
        record.us_citizen || '',
        record.id_type || '',
        record.time_in || '',
        record.time_out || '',
        record.badge_number || ''
      ].join(' | ');
      doc.fontSize(8).text(`${index + 1}. ${rowText}`, { width: 532 });
      doc.moveDown(0.3);
    });

    doc.end();
  });
}

async function sendEmail({ to, subject, text, html, attachments }) {
  const from = process.env.NOTIFY_FROM_EMAIL || 'nissignin@nw-its.com';
  const transporter = getTransporter();

  if (!transporter) {
    console.warn('SMTP is not configured. Skipping email send.');
    return { sent: false, skipped: true, reason: 'SMTP is not configured' };
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments
  });

  return { sent: true, skipped: false };
}

async function sendVisitorSigninNotification(signin) {
  const to = process.env.VISITOR_ALERT_TO || 'rebecca.bunch@nw-its.com';
  const subject = `Visitor Sign-In: ${signin.full_name} (${signin.company})`;
  const text = [
    'A new visitor has signed in.',
    '',
    `Date: ${String(signin.visit_date).slice(0, 10)}`,
    `Name: ${signin.full_name}`,
    `Company: ${signin.company}`,
    `Appointment With: ${signin.appointment_with || ''}`,
    `Clearance Level: ${signin.clearance_level || ''}${signin.clearance_level_other ? ` (${signin.clearance_level_other})` : ''}`,
    `US Citizen: ${signin.us_citizen || ''}`,
    `ID Type: ${signin.id_type || ''}${signin.id_type_other ? ` (${signin.id_type_other})` : ''}`,
    `Time In: ${signin.time_in || ''}`,
    `Time Out: ${signin.time_out || ''}`,
    `Badge #: ${signin.badge_number || ''}`,
    `Submitted At: ${signin.submitted_at}`
  ].join('\n');

  return sendEmail({ to, subject, text });
}

async function sendDailyVisitorReport({ date, records }) {
  const to = process.env.VISITOR_ALERT_TO || 'rebecca.bunch@nw-its.com';
  const subject = `Daily Visitor Report - ${date}`;
  const text = `Attached is the daily visitor report for ${date}. Total visitors: ${records.length}.`;
  const pdfBuffer = await buildDailyReportPdf({ date, records });

  return sendEmail({
    to,
    subject,
    text,
    attachments: [
      {
        filename: `daily-visitor-report-${date}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

module.exports = { sendEmail, sendVisitorSigninNotification, sendDailyVisitorReport };
