const nodemailer = require('nodemailer');

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

async function sendEmail({ to, subject, text }) {
  const from = process.env.NOTIFY_FROM_EMAIL || 'smefinder@nw-its.com';
  const transporter = getTransporter();

  if (!transporter) {
    console.warn('SMTP is not configured. Skipping email send.');
    return { sent: false, skipped: true };
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  return { sent: true, skipped: false };
}

async function sendVisitorSigninNotification(signin) {
  const to = process.env.VISITOR_ALERT_TO || 'rebecca.bunch@nw-its.com';
  const subject = `Visitor Sign-In: ${signin.full_name} (${signin.company})`;
  const text = [
    'A new visitor has signed in.',
    '',
    `Name: ${signin.full_name}`,
    `Company: ${signin.company}`,
    `Email: ${signin.email}`,
    `Phone: ${signin.phone}`,
    `Purpose: ${signin.purpose_of_visit}`,
    `Visit Date: ${String(signin.visit_date).slice(0, 10)}`,
    `Submitted At: ${signin.submitted_at}`
  ].join('\n');

  return sendEmail({ to, subject, text });
}

module.exports = { sendEmail, sendVisitorSigninNotification };
