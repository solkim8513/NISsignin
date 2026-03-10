const pool = require('../db/pool');

const DEFAULT_FROM = 'smefinder@nw-its.com';

async function logNotification({ requestId, smeId, sender, channel, recipient, subject, body, status = 'sent' }) {
  await pool.query(
    `INSERT INTO sme_notifications (request_id, sme_id, sender, channel, recipient, subject, body, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [requestId, smeId, sender || DEFAULT_FROM, channel, recipient, subject, body, status]
  );
}

async function notifySme({ request, sme }) {
  const sender = process.env.NOTIFY_FROM_EMAIL || DEFAULT_FROM;
  const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
  const acceptUrl = `${baseUrl}/respond?token=${request.response_token}&action=accept`;
  const declineUrl = `${baseUrl}/respond?token=${request.response_token}&action=decline`;
  const subject = `SME request: ${request.opportunity_name}`;
  const body = `From: ${sender}\nTopic: ${request.topic}\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`;

  const primaryEmail = sme.nis_email || sme.federal_email || sme.pm_email;

  if (sme.preferred_contact === 'teams' && sme.teams_id) {
    await logNotification({
      requestId: request.id,
      smeId: sme.id,
      sender,
      channel: 'teams',
      recipient: sme.teams_id,
      subject,
      body
    });
  } else {
    const recipient = primaryEmail || sender;
    await logNotification({
      requestId: request.id,
      smeId: sme.id,
      sender,
      channel: 'email',
      recipient,
      subject,
      body,
      status: primaryEmail ? 'sent' : 'sent_fallback_recipient'
    });
  }
}

module.exports = { notifySme, logNotification };
