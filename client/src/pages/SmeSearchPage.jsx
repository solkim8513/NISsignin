import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';

const CLEARANCE_OPTIONS = [
  'Public Trust',
  'Confidential',
  'Secret',
  'Top Secret',
  'TS/SCI',
  'Top Secret/SCI',
  'CUI',
  'None',
  'Unknown',
  'Other'
];

export default function SmeSearchPage() {
  const [filters, setFilters] = useState({ search: '', skillset: '', clearance: '', clearance_other: '', availability: '' });
  const [rows, setRows] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    skillsets: '',
    clearance_level: '',
    clearance_other: '',
    availability_status: 'available'
  });
  const [message, setMessage] = useState('');

  async function load() {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === 'clearance_other') return;
      if (k === 'clearance' && v === 'Other') {
        if (filters.clearance_other.trim()) query.set('clearance', filters.clearance_other.trim());
        return;
      }
      query.set(k, v);
    });
    const data = await apiGet(`/api/smes?${query.toString()}`);
    setRows(data);
  }

  async function createSme(e) {
    e.preventDefault();
    setMessage('');
    const clearanceLevel = form.clearance_level === 'Other' ? form.clearance_other.trim() : form.clearance_level;
    await apiPost('/api/smes', {
      name: form.name,
      skillsets: form.skillsets.split(';').map((v) => v.trim()).filter(Boolean),
      certifications: [],
      clearance_level: clearanceLevel || null,
      availability_status: form.availability_status
    });
    setForm({ name: '', skillsets: '', clearance_level: '', clearance_other: '', availability_status: 'available' });
    setShowAdd(false);
    setMessage('SME added.');
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">SME Directory</h1>
        <div className="flex gap-2">
          <Link to="/smes/import" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Bulk Import
          </Link>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setShowAdd((v) => !v)}>
            + Add SME
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
        <input className="rounded-md border border-slate-300 p-2" placeholder="Search by name, title..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input className="rounded-md border border-slate-300 p-2" placeholder="Skillset" value={filters.skillset} onChange={(e) => setFilters({ ...filters, skillset: e.target.value })} />
        <select className="rounded-md border border-slate-300 p-2" value={filters.clearance} onChange={(e) => setFilters({ ...filters, clearance: e.target.value })}>
          <option value="">All clearances</option>
          {CLEARANCE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {filters.clearance === 'Other' ? (
          <input
            className="rounded-md border border-slate-300 p-2"
            placeholder="Type custom clearance"
            value={filters.clearance_other}
            onChange={(e) => setFilters({ ...filters, clearance_other: e.target.value })}
          />
        ) : (
          <div />
        )}
        <select className="rounded-md border border-slate-300 p-2" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="limited">Limited</option>
          <option value="unavailable">Unavailable</option>
        </select>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" onClick={load}>Search</button>
      </div>

      {showAdd && (
        <form className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-5" onSubmit={createSme}>
          <input className="rounded-md border border-slate-300 p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded-md border border-slate-300 p-2" placeholder="Skillsets (use ;)" value={form.skillsets} onChange={(e) => setForm({ ...form, skillsets: e.target.value })} />
          <select className="rounded-md border border-slate-300 p-2" value={form.clearance_level} onChange={(e) => setForm({ ...form, clearance_level: e.target.value })}>
            <option value="">Select clearance</option>
            {CLEARANCE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {form.clearance_level === 'Other' ? (
            <input
              className="rounded-md border border-slate-300 p-2"
              placeholder="Type custom clearance"
              value={form.clearance_other}
              onChange={(e) => setForm({ ...form, clearance_other: e.target.value })}
              required
            />
          ) : (
            <div />
          )}
          <select className="rounded-md border border-slate-300 p-2" value={form.availability_status} onChange={(e) => setForm({ ...form, availability_status: e.target.value })}>
            <option value="available">Available</option>
            <option value="limited">Limited</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 md:col-span-5" type="submit">
            Save SME
          </button>
        </form>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {!rows.length ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <p>No SMEs found.</p>
            <button className="mt-2 text-blue-600 hover:underline" onClick={() => setShowAdd(true)}>
              Add the first SME
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="p-3">Name</th>
                <th className="p-3">Clearance</th>
                <th className="p-3">Availability</th>
                <th className="p-3">Skillsets</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.clearance_level || '-'}</td>
                  <td className="p-3">{s.availability_status}</td>
                  <td className="p-3 text-slate-600">{(s.skillsets || []).join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
