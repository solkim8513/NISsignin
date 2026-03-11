import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../lib/api';

function todayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getApiErrorMessage(error, fallback) {
  if (!error?.message) return fallback;
  try {
    const parsed = JSON.parse(error.message);
    return parsed?.error || fallback;
  } catch {
    return error.message || fallback;
  }
}

function getSessionAwareError(error, fallback) {
  const message = getApiErrorMessage(error, fallback);
  if (/invalid token|missing token|not authenticated|forbidden/i.test(message)) {
    return 'Your admin session expired. Please sign out and sign back in.';
  }
  return message;
}

export default function VisitorKioskPage() {
  const [date, setDate] = useState(todayDate());
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [qrImage, setQrImage] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('info');

  const role = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').role || 'viewer';
    } catch {
      return 'viewer';
    }
  }, []);

  async function loadRecords(nextDate = date) {
    const data = await apiGet(`/api/visitor-signins?date=${nextDate}`);
    setRecords(data.records || []);
    setTotal(data.total || 0);
  }

  async function loadQr() {
    const configuredPublicBaseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
    const baseUrl = configuredPublicBaseUrl || window.location.origin;
    const url = `${baseUrl}/visitor-signin`;
    const qr = await apiGet(`/api/visitor-signins/qr?url=${encodeURIComponent(url)}`);
    setPublicUrl(qr.url);
    setQrImage(qr.image_data_url);
  }

  useEffect(() => {
    let canceled = false;

    async function init() {
      let recordsError = '';
      let qrError = '';

      try {
        await loadRecords();
      } catch (error) {
        recordsError = getSessionAwareError(error, 'Unable to load daily records right now.');
      }

      try {
        await loadQr();
      } catch (error) {
        qrError = getApiErrorMessage(error, 'Unable to generate QR right now.');
      }

      if (canceled) return;

      if (recordsError) {
        setMessageTone('error');
        setMessage(recordsError);
        return;
      }

      if (qrError) {
        setMessageTone('error');
        setMessage(`Daily records loaded, but QR is unavailable: ${qrError}`);
      }
    }

    init();
    return () => {
      canceled = true;
    };
  }, []);

  async function refresh() {
    setMessage('');
    setMessageTone('info');
    try {
      await Promise.all([loadRecords(), loadQr()]);
      setMessageTone('success');
      setMessage('Kiosk data refreshed.');
    } catch (error) {
      setMessageTone('error');
      setMessage(getSessionAwareError(error, 'Refresh failed.'));
    }
  }

  async function clearSelectedDate() {
    setMessage('');
    setMessageTone('info');
    try {
      const result = await apiDelete(`/api/visitor-signins/by-date?date=${date}`);
      await loadRecords(date);
      setMessageTone('success');
      setMessage(`Deleted ${result.deleted} records for ${date}.`);
    } catch {
      setMessageTone('error');
      setMessage('Unable to clear selected date.');
    }
  }

  async function sendDailyReport() {
    setMessage('');
    setMessageTone('info');
    try {
      const result = await apiPost('/api/visitor-signins/report/daily', { date });
      if (result.report?.sent) {
        setMessageTone('success');
        setMessage(`Daily PDF report for ${date} sent to Rebecca.`);
      } else {
        setMessageTone('error');
        setMessage(`Report generation completed, but email was skipped: ${result.report?.reason || 'check SMTP settings'}.`);
      }
    } catch (sendError) {
      setMessageTone('error');
      setMessage(getApiErrorMessage(sendError, 'Unable to send daily report email.'));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Visitor Sign-In Kiosk</h1>
        <p className="mt-1 text-sm text-slate-500">
          Use the QR code for personal phones, or open the public URL on the lobby iPad browser.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Public Sign-In Link</h2>
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm break-all">{publicUrl}</p>
          {publicUrl && /(localhost|127\.0\.0\.1)/i.test(publicUrl) && (
            <p className="mt-2 text-xs text-amber-700">
              This link is localhost-only. Set VITE_PUBLIC_BASE_URL to a shareable host (for example
              {' '}http://YOUR-IP:5173) before sharing.
            </p>
          )}
          <a
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Sign-In Page
          </a>
          {qrImage && <img src={qrImage} alt="Visitor sign-in QR code" className="mt-4 h-56 w-56 rounded-md border border-slate-200 p-2" />}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Daily Log</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="rounded-md border border-slate-300 p-2"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                loadRecords(next).catch((error) => {
                  setMessageTone('error');
                  setMessage(getSessionAwareError(error, 'Unable to load selected date.'));
                });
              }}
            />
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={refresh}>
              Refresh
            </button>
            {(role === 'admin' || role === 'proposal_manager') && (
              <button className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={sendDailyReport}>
                Email Daily PDF to Rebecca
              </button>
            )}
            {role === 'admin' && (
              <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700" onClick={clearSelectedDate}>
                Clear This Date
              </button>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-600">Total sign-ins for {date}: <span className="font-semibold">{total}</span></p>
          {message && (
            <p className={`mt-2 text-sm ${messageTone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
              {message}
            </p>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="p-3">Date</th>
              <th className="p-3">Time</th>
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Appointment</th>
              <th className="p-3">Clearance</th>
              <th className="p-3">US Citizen</th>
              <th className="p-3">ID Type</th>
              <th className="p-3">Time In</th>
              <th className="p-3">Time Out</th>
              <th className="p-3">Badge #</th>
            </tr>
          </thead>
          <tbody>
            {!records.length ? (
              <tr><td className="p-4 text-slate-500" colSpan={11}>No sign-ins for this date.</td></tr>
            ) : (
              records.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3">{String(row.visit_date).slice(0, 10)}</td>
                  <td className="p-3">{new Date(row.submitted_at).toLocaleTimeString()}</td>
                  <td className="p-3 font-medium">{row.full_name}</td>
                  <td className="p-3">{row.company}</td>
                  <td className="p-3">{row.appointment_with}</td>
                  <td className="p-3">
                    {row.clearance_level}
                    {row.clearance_level_other ? ` (${row.clearance_level_other})` : ''}
                  </td>
                  <td className="p-3">{row.us_citizen}</td>
                  <td className="p-3">
                    {row.id_type}
                    {row.id_type_other ? ` (${row.id_type_other})` : ''}
                  </td>
                  <td className="p-3">{row.time_in}</td>
                  <td className="p-3">{row.time_out || '-'}</td>
                  <td className="p-3">{row.badge_number}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
