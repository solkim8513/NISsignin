import { useState } from 'react';
import { apiPost } from '../lib/api';
import nisLogo from '../assets/nis-logo.svg';

const initialForm = {
  full_name: '',
  company: '',
  email: '',
  phone: '',
  purpose_of_visit: ''
};

export default function VisitorSigninPage() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiPost('/api/visitor-signins/public', form);
      setSubmitted(true);
      setForm(initialForm);
    } catch {
      setError('Unable to submit right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 px-4 py-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <img
          src={nisLogo}
          alt="NIS logo"
          className="mx-auto mb-4 w-full max-w-sm h-auto rounded border border-slate-200 p-2"
        />
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Visitor Sign-In</h1>
        <p className="mt-2 text-sm text-slate-600">Nationwide IT Services, Inc. - Please complete all fields.</p>

        {submitted && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Thank you. Your sign-in has been recorded.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="mt-5 space-y-3" onSubmit={submit}>
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
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="w-full rounded-md border border-slate-300 p-3 text-base"
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <textarea
            className="w-full rounded-md border border-slate-300 p-3 text-base"
            placeholder="Purpose of visit"
            value={form.purpose_of_visit}
            onChange={(e) => setForm({ ...form, purpose_of_visit: e.target.value })}
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
