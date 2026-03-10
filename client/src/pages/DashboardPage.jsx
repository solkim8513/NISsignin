import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    Promise.all([apiGet('/api/admin/dashboard'), apiGet('/api/sme-requests')])
      .then(([dashboard, reqs]) => {
        setData(dashboard);
        setRequests(reqs.slice(0, 5));
      })
      .catch(() => setData({ error: true }));
  }, []);

  if (!data) return <p>Loading dashboard...</p>;
  if (data.error) return <p className="text-red-600">Admin access required.</p>;

  const cards = [
    {
      label: 'SMEs in Directory',
      value: data.total_smes,
      className: 'rounded-xl border border-slate-200 bg-white p-5',
      valueClass: 'mt-2 text-4xl font-semibold text-blue-600',
      to: '/smes'
    },
    {
      label: 'Open Requests',
      value: data.open_requests,
      className: 'rounded-xl border border-slate-200 bg-white p-5',
      valueClass: 'mt-2 text-4xl font-semibold text-indigo-600',
      to: '/requests'
    },
    {
      label: 'Overdue',
      value: data.overdue_items,
      className: 'rounded-xl border border-red-100 bg-red-50/50 p-5',
      valueClass: 'mt-2 text-4xl font-semibold text-red-600',
      to: '/requests#overdue'
    },
    {
      label: 'Completed (recent)',
      value: data.completed_recent,
      className: 'rounded-xl border border-emerald-100 bg-emerald-50/60 p-5',
      valueClass: 'mt-2 text-4xl font-semibold text-emerald-600',
      to: '/requests#completed'
    }
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className={`${card.className} block transition hover:-translate-y-0.5 hover:shadow`}
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={card.valueClass}>{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Recent Requests</h2>
        {!requests.length ? (
          <p className="text-slate-500">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id}>
                <Link to={`/requests#${r.status}`} className="block rounded-md border border-slate-100 px-3 py-2 text-sm transition hover:bg-slate-50">
                  <span className="font-medium">{r.opportunity_name}</span>
                  <span className="ml-2 text-slate-500">({r.status})</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
