import { useState } from 'react';
import { apiPost } from '../lib/api';
import nisLogo from '../assets/nis-logo-original.png';

const TIME_DIGITS_REGEX = /^\d{4}$/;
const NUMERIC_REGEX = /^\d+$/;
const CLEARANCE_OPTIONS = ['none', 'public trust', 'confidential', 'secret', 'top secret', 'ts/sci', 'other'];
const ID_TYPE_OPTIONS = ['state id', 'dl', 'other'];

function todayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function createInitialForm() {
  return {
    visit_date: todayDate(),
    full_name: '',
    company: '',
    appointment_with: '',
    clearance_level: '',
    clearance_level_other: '',
    us_citizen: '',
    id_type: '',
    id_type_other: '',
    time_in: '',
    time_out: '',
    badge_number: ''
  };
}

function getApiErrorMessage(error) {
  const fallback = 'Unable to submit right now. Please try again.';
  if (!error || !error.message) return fallback;
  try {
    const parsed = JSON.parse(error.message);
    if (parsed && parsed.error) return parsed.error;
  } catch {
    return error.message || fallback;
  }
  return fallback;
}

export default function VisitorSigninPage() {
  const [form, setForm] = useState(createInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const normalizedForm = {
      ...form,
      visit_date: form.visit_date || todayDate(),
      full_name: form.full_name.trim(),
      company: form.company.trim(),
      appointment_with: form.appointment_with.trim(),
      clearance_level: form.clearance_level.trim().toLowerCase(),
      clearance_level_other: form.clearance_level_other.trim(),
      us_citizen: form.us_citizen.trim().toLowerCase(),
      id_type: form.id_type.trim().toLowerCase(),
      id_type_other: form.id_type_other.trim(),
      time_in: form.time_in.trim(),
      time_out: form.time_out.trim(),
      badge_number: form.badge_number.trim()
    };

    if (
      !normalizedForm.full_name ||
      !normalizedForm.company ||
      !normalizedForm.appointment_with ||
      !normalizedForm.clearance_level ||
      !normalizedForm.us_citizen ||
      !normalizedForm.id_type ||
      !normalizedForm.time_in ||
      !normalizedForm.badge_number
    ) {
      setError('Please complete all required fields.');
      return;
    }
    if (normalizedForm.clearance_level === 'other' && !normalizedForm.clearance_level_other) {
      setError('Please enter a value for Clearance Level (Other).');
      return;
    }
    if (normalizedForm.id_type === 'other' && !normalizedForm.id_type_other) {
      setError('Please enter a value for Type of ID (Other).');
      return;
    }
    if (!TIME_DIGITS_REGEX.test(normalizedForm.time_in)) {
      setError('Time In must be exactly 4 numbers (HHMM), for example 0930.');
      return;
    }
    if (normalizedForm.time_out && !TIME_DIGITS_REGEX.test(normalizedForm.time_out)) {
      setError('Time Out must be exactly 4 numbers (HHMM), for example 1730.');
      return;
    }
    if (!NUMERIC_REGEX.test(normalizedForm.badge_number)) {
      setError('Badge number must contain numbers only.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiPost('/api/visitor-signins/public', normalizedForm);
      setSubmitted(true);
      setForm(createInitialForm());
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToForm() {
    setSubmitted(false);
    setError('');
    setForm(createInitialForm());
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 px-4 py-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Visitor Sign-In</h1>
        <p className="mt-2 text-sm text-slate-600">Nationwide IT Services, Inc. - Please complete all fields.</p>

        {submitted ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <p className="text-base font-medium">Thank you. Your sign-in has been recorded.</p>
            <p className="mt-2 text-sm text-emerald-800">Need to register another visitor? Select Return to form.</p>
            <button
              type="button"
              onClick={returnToForm}
              className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Return to form
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={submit}>
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                type="date"
                value={form.visit_date}
                readOnly
                title="Date is auto-filled to today."
                required
              />
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                placeholder="Full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                required
              />
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                placeholder="Appointment with"
                value={form.appointment_with}
                onChange={(e) => setForm({ ...form, appointment_with: e.target.value })}
                required
              />
              <select
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                value={form.clearance_level}
                onChange={(e) => setForm({ ...form, clearance_level: e.target.value, clearance_level_other: '' })}
                required
              >
                <option value="">Clearance level</option>
                {CLEARANCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                value={form.us_citizen}
                onChange={(e) => setForm({ ...form, us_citizen: e.target.value })}
                required
              >
                <option value="">US Citizen</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {form.clearance_level === 'other' && (
                <label className="w-full text-sm text-slate-600 md:col-span-2">
                  Clearance Level - Other
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 p-3 text-base"
                    placeholder="Enter clearance level"
                    value={form.clearance_level_other}
                    onChange={(e) => setForm({ ...form, clearance_level_other: e.target.value })}
                    required
                  />
                </label>
              )}
              <select
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value, id_type_other: '' })}
                required
              >
                <option value="">Type of ID</option>
                {ID_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
              {form.id_type === 'other' && (
                <label className="w-full text-sm text-slate-600 md:col-span-2">
                  Type of ID - Other
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 p-3 text-base"
                    placeholder="Enter ID type"
                    value={form.id_type_other}
                    onChange={(e) => setForm({ ...form, id_type_other: e.target.value })}
                    required
                  />
                </label>
              )}
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Time In (HHMM)"
                value={form.time_in}
                onChange={(e) => setForm({ ...form, time_in: e.target.value.replace(/\D/g, '') })}
                required
              />
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Time Out (HHMM)"
                value={form.time_out}
                onChange={(e) => setForm({ ...form, time_out: e.target.value.replace(/\D/g, '') })}
              />
              <input
                className="w-full rounded-md border border-slate-300 p-3 text-base"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Badge #"
                value={form.badge_number}
                onChange={(e) => setForm({ ...form, badge_number: e.target.value.replace(/\D/g, '') })}
                required
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-60 md:col-span-2"
              >
                {isSubmitting ? 'Submitting...' : 'Sign In'}
              </button>
            </form>
          </>
        )}

        <img
          src={nisLogo}
          alt="NIS logo"
          className="mx-auto mt-6 block h-auto max-w-full"
        />
      </div>
    </div>
  );
}
