import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../lib/api';

const columns = [
  { key: 'pending', label: 'Pending', tone: 'border-amber-200 bg-amber-50/50' },
  { key: 'accepted', label: 'Accepted', tone: 'border-blue-200 bg-blue-50/50' },
  { key: 'in_progress', label: 'In Progress', tone: 'border-indigo-200 bg-indigo-50/50' },
  { key: 'completed', label: 'Completed', tone: 'border-emerald-200 bg-emerald-50/50' },
  { key: 'declined', label: 'Declined', tone: 'border-rose-200 bg-rose-50/50' },
  { key: 'overdue', label: 'Overdue', tone: 'border-red-200 bg-red-50/50' }
];

const trackingEventOptions = [
  { value: 'proposal_note', label: 'Proposal Note' },
  { value: 'reach_out_attempt', label: 'Reach-out Attempt' },
  { value: 'email_exchange', label: 'Email Exchange' },
  { value: 'teams_exchange', label: 'MS Teams Exchange' }
];

const eventTypeLabel = {
  proposal_note: 'Proposal Note',
  reach_out_attempt: 'Reach-out Attempt',
  email_exchange: 'Email Exchange',
  teams_exchange: 'MS Teams Exchange',
  status_change: 'Status Change',
  admin_edit: 'Admin Edit',
  reassignment: 'Reassignment'
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function readUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || 'viewer';
  } catch {
    return 'viewer';
  }
}

export default function RequestsPage() {
  const location = useLocation();
  const columnRefs = useRef({});
  const role = readUserRole();
  const isAdmin = role === 'admin';

  const [requests, setRequests] = useState([]);
  const [smes, setSmes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [draggedRequestId, setDraggedRequestId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState('');
  const [form, setForm] = useState({ opportunity_name: '', topic: '', due_date: '', assigned_sme_id: '', notes: '' });

  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [noteForm, setNoteForm] = useState({ event_type: 'proposal_note', note: '' });
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  const [detailForm, setDetailForm] = useState({ opportunity_name: '', topic: '', due_date: '', status: 'pending' });
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailMessage, setDetailMessage] = useState('');

  const [reassignModal, setReassignModal] = useState({
    open: false,
    request: null,
    selectedSmeId: '',
    note: '',
    search: '',
    suggestions: [],
    loading: false,
    saving: false,
    message: ''
  });

  async function load() {
    const [reqs, people] = await Promise.all([apiGet('/api/sme-requests'), apiGet('/api/smes')]);
    setRequests(reqs);
    setSmes(people);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showForm || !form.topic.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const data = await apiGet(`/api/sme-requests/suggestions?topic=${encodeURIComponent(form.topic)}`);
        setSuggestions(data.suggestions || []);
      } finally {
        setIsSuggesting(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.topic, showForm]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const target = columnRefs.current[hash];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [location.hash, requests.length]);

  async function createRequest(e) {
    e.preventDefault();
    await apiPost('/api/sme-requests', form);
    setForm({ opportunity_name: '', topic: '', due_date: '', assigned_sme_id: '', notes: '' });
    setSuggestions([]);
    setShowForm(false);
    await load();
  }

  function handleDragStart(requestId) {
    setDraggedRequestId(requestId);
  }

  function resetDragState() {
    setDraggedRequestId(null);
    setDragOverColumn('');
  }

  function handleDragOver(event, status) {
    event.preventDefault();
    if (dragOverColumn !== status) setDragOverColumn(status);
  }

  async function handleDrop(event, status) {
    event.preventDefault();
    if (!draggedRequestId) return;

    const existing = requests.find((row) => row.id === draggedRequestId);
    if (!existing || existing.status === status) {
      resetDragState();
      return;
    }

    setRequests((current) => current.map((row) => (row.id === draggedRequestId ? { ...row, status } : row)));

    try {
      await apiPut(`/api/sme-requests/${draggedRequestId}`, { status });
      if (selectedRequestId === draggedRequestId) {
        const refreshed = await apiGet(`/api/sme-requests/${draggedRequestId}/tracking`);
        setTrackingData(refreshed);
        setDetailForm((old) => ({ ...old, status }));
      }
    } catch {
      await load();
    } finally {
      resetDragState();
    }
  }

  async function openTrackingModal(requestId) {
    setSelectedRequestId(requestId);
    setTrackingData(null);
    setTrackingLoading(true);
    setNoteForm({ event_type: 'proposal_note', note: '' });
    setNoteMessage('');
    setDetailMessage('');

    try {
      const data = await apiGet(`/api/sme-requests/${requestId}/tracking`);
      setTrackingData(data);
      setDetailForm({
        opportunity_name: data.request.opportunity_name || '',
        topic: data.request.topic || '',
        due_date: data.request.due_date ? String(data.request.due_date).slice(0, 10) : '',
        status: data.request.status || 'pending'
      });
    } finally {
      setTrackingLoading(false);
    }
  }

  function closeTrackingModal() {
    setSelectedRequestId('');
    setTrackingData(null);
    setNoteMessage('');
    setDetailMessage('');
  }

  async function saveTrackingNote(e) {
    e.preventDefault();
    if (!selectedRequestId || !noteForm.note.trim()) return;

    setNoteSaving(true);
    setNoteMessage('');
    try {
      await apiPost(`/api/sme-requests/${selectedRequestId}/tracking-notes`, noteForm);
      const refreshed = await apiGet(`/api/sme-requests/${selectedRequestId}/tracking`);
      setTrackingData(refreshed);
      setNoteForm((current) => ({ ...current, note: '' }));
      setNoteMessage('Tracking note saved.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function saveRequestDetails(e) {
    e.preventDefault();
    if (!isAdmin || !selectedRequestId) return;

    setDetailSaving(true);
    setDetailMessage('');
    try {
      await apiPut(`/api/sme-requests/${selectedRequestId}`, {
        opportunity_name: detailForm.opportunity_name,
        topic: detailForm.topic,
        due_date: detailForm.due_date,
        status: detailForm.status
      });

      const refreshed = await apiGet(`/api/sme-requests/${selectedRequestId}/tracking`);
      setTrackingData(refreshed);
      await load();
      setDetailMessage('Request details updated.');
    } finally {
      setDetailSaving(false);
    }
  }

  async function openReassignModal(request) {
    const next = {
      open: true,
      request,
      selectedSmeId: '',
      note: '',
      search: '',
      suggestions: [],
      loading: true,
      saving: false,
      message: ''
    };
    setReassignModal(next);

    try {
      const data = await apiGet(`/api/sme-requests/suggestions?topic=${encodeURIComponent(request.topic || '')}`);
      const ai = data.suggestions || [];
      setReassignModal((current) => ({
        ...current,
        suggestions: ai,
        selectedSmeId: ai[0]?.id || '',
        loading: false
      }));
    } catch {
      setReassignModal((current) => ({ ...current, loading: false }));
    }
  }

  function closeReassignModal() {
    setReassignModal({
      open: false,
      request: null,
      selectedSmeId: '',
      note: '',
      search: '',
      suggestions: [],
      loading: false,
      saving: false,
      message: ''
    });
  }

  async function applyReassignment() {
    if (!reassignModal.request || !reassignModal.selectedSmeId) return;

    setReassignModal((current) => ({ ...current, saving: true, message: '' }));
    try {
      await apiPost(`/api/sme-requests/${reassignModal.request.id}/reassign`, {
        assigned_sme_id: reassignModal.selectedSmeId,
        note: reassignModal.note
      });

      await load();
      if (selectedRequestId === reassignModal.request.id) {
        const refreshed = await apiGet(`/api/sme-requests/${selectedRequestId}/tracking`);
        setTrackingData(refreshed);
      }
      closeReassignModal();
    } catch {
      setReassignModal((current) => ({
        ...current,
        saving: false,
        message: 'Reassignment failed. Please try again.'
      }));
    }
  }

  const board = useMemo(() => {
    const map = Object.fromEntries(columns.map((col) => [col.key, []]));
    for (const req of requests) {
      if (map[req.status]) map[req.status].push(req);
    }
    return map;
  }, [requests]);

  const timeline = useMemo(() => {
    if (!trackingData) return [];

    const trackingItems = (trackingData.tracking || []).map((item) => ({
      id: `tracking-${item.id}`,
      at: item.created_at,
      title: eventTypeLabel[item.event_type] || item.event_type,
      detail: item.note,
      meta: item.created_by_name || 'System'
    }));

    const notificationItems = (trackingData.notifications || []).map((item) => ({
      id: `notif-${item.id}`,
      at: item.sent_at,
      title: `${String(item.channel || '').toUpperCase()} send (${item.status})`,
      detail: `From ${item.sender} to ${item.recipient}${item.subject ? ` | ${item.subject}` : ''}`,
      meta: 'Notification log'
    }));

    return [...trackingItems, ...notificationItems].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [trackingData]);

  const filteredSmesForReassign = useMemo(() => {
    const search = reassignModal.search.trim().toLowerCase();
    return smes
      .filter((sme) => sme.is_active)
      .filter((sme) => {
        if (!search) return true;
        const haystack = `${sme.name} ${(sme.skillsets || []).join(' ')}`.toLowerCase();
        return haystack.includes(search);
      })
      .slice(0, 100);
  }, [reassignModal.search, smes]);

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">SME Requests</h1>
            <p className="mt-1 text-sm text-slate-500">Drag request cards across columns to update status manually.</p>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setShowForm((v) => !v)}>
            + New Request
          </button>
        </div>

        {showForm && (
          <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" onSubmit={createRequest}>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-md border border-slate-300 p-2" placeholder="Opportunity name" value={form.opportunity_name} onChange={(e) => setForm({ ...form, opportunity_name: e.target.value })} required />
              <input className="rounded-md border border-slate-300 p-2" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </div>

            <textarea className="w-full rounded-md border border-slate-300 p-2" placeholder="Topic / area needed (e.g., databricks, network, sharepoint...)" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
            <textarea className="w-full rounded-md border border-slate-300 p-2" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

            <select className="w-full rounded-md border border-slate-300 p-2" value={form.assigned_sme_id} onChange={(e) => setForm({ ...form, assigned_sme_id: e.target.value })}>
              <option value="">Assign SME manually</option>
              {smes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">AI Suggestions (Top 3)</p>
                {isSuggesting && <span className="text-xs text-slate-500">Searching...</span>}
              </div>
              {!form.topic.trim() && <p className="text-sm text-slate-500">Type topic keywords to get suggestions.</p>}
              {!!form.topic.trim() && !isSuggesting && !suggestions.length && <p className="text-sm text-slate-500">No strong match found yet.</p>}
              <div className="grid gap-2 md:grid-cols-3">
                {suggestions.map((item) => (
                  <button key={item.id} type="button" onClick={() => setForm({ ...form, assigned_sme_id: item.id })} className={`rounded-lg border p-3 text-left transition hover:border-blue-400 ${form.assigned_sme_id === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-600">Score: {item.score}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.reason}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">Create Request & Notify SME</button>
            </div>
          </form>
        )}

        {!requests.length ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
            <p>No requests found.</p>
            <button className="mt-2 text-blue-600 hover:underline" onClick={() => setShowForm(true)}>Create one</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[1200px] grid-cols-6 gap-4">
              {columns.map((col) => (
                <section key={col.key} id={col.key} ref={(element) => { columnRefs.current[col.key] = element; }} className={`rounded-xl border p-3 transition ${col.tone} ${dragOverColumn === col.key ? 'ring-2 ring-blue-300' : ''}`} onDragOver={(event) => handleDragOver(event, col.key)} onDrop={(event) => handleDrop(event, col.key)}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800">{col.label}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{board[col.key].length}</span>
                  </div>

                  <div className="space-y-2">
                    {board[col.key].map((r) => (
                      <article key={r.id} className="cursor-move rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm" draggable onDragStart={() => handleDragStart(r.id)} onDragEnd={resetDragState}>
                        <p className="font-semibold text-slate-800">{r.opportunity_name}</p>
                        <p className="mt-1 text-xs text-slate-600">{r.topic}</p>
                        <p className="mt-2 text-xs text-slate-500">Due: {r.due_date?.slice(0, 10) || '-'}</p>
                        {r.assigned_sme_name && <p className="text-xs text-slate-500">SME: {r.assigned_sme_name}</p>}
                        <div className="mt-2 flex gap-2">
                          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openTrackingModal(r.id); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Open</button>
                          {isAdmin && ['declined', 'overdue'].includes(r.status) && (
                            <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openReassignModal(r); }} className="rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600">Reassign</button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Request Tracking</h2>
              <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={closeTrackingModal}>Close</button>
            </div>

            {trackingLoading && <p className="text-sm text-slate-500">Loading tracking...</p>}

            {!trackingLoading && trackingData && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p><span className="font-semibold">Opportunity:</span> {trackingData.request.opportunity_name}</p>
                  <p><span className="font-semibold">Status:</span> {trackingData.request.status}</p>
                  <p><span className="font-semibold">Due:</span> {trackingData.request.due_date?.slice(0, 10)}</p>
                  <p><span className="font-semibold">Assigned SME:</span> {trackingData.request.assigned_sme_name || '-'}</p>
                  {isAdmin && ['declined', 'overdue'].includes(trackingData.request.status) && (
                    <button className="mt-2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600" onClick={() => openReassignModal(trackingData.request)}>
                      Open Reassign Workspace
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <form onSubmit={saveRequestDetails} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-700">Admin Edit Request Details</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input className="rounded-md border border-slate-300 p-2 text-sm" placeholder="Opportunity name" value={detailForm.opportunity_name} onChange={(e) => setDetailForm({ ...detailForm, opportunity_name: e.target.value })} required />
                      <input className="rounded-md border border-slate-300 p-2 text-sm" type="date" value={detailForm.due_date} onChange={(e) => setDetailForm({ ...detailForm, due_date: e.target.value })} required />
                    </div>
                    <textarea className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="Topic / area needed" value={detailForm.topic} onChange={(e) => setDetailForm({ ...detailForm, topic: e.target.value })} required />
                    <select className="mt-2 rounded-md border border-slate-300 p-2 text-sm" value={detailForm.status} onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}>
                      {columns.map((col) => <option key={col.key} value={col.key}>{col.label}</option>)}
                    </select>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-emerald-700">{detailMessage}</span>
                      <button type="submit" disabled={detailSaving} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
                        {detailSaving ? 'Saving...' : 'Save Details'}
                      </button>
                    </div>
                  </form>
                )}

                <form onSubmit={saveTrackingNote} className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Add Tracking Note</p>
                  <div className="grid gap-2 md:grid-cols-4">
                    <select className="rounded-md border border-slate-300 p-2 text-sm" value={noteForm.event_type} onChange={(e) => setNoteForm({ ...noteForm, event_type: e.target.value })}>
                      {trackingEventOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <textarea className="rounded-md border border-slate-300 p-2 text-sm md:col-span-3" placeholder="Add note about outreach, exchange, or decision" value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} required />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-emerald-700">{noteMessage}</span>
                    <button type="submit" disabled={noteSaving || !noteForm.note.trim()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                      {noteSaving ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </form>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Timeline</h3>
                  {!timeline.length ? (
                    <p className="text-sm text-slate-500">No tracking yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {timeline.map((item) => (
                        <li key={item.id} className="rounded-md border border-slate-100 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-800">{item.title}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(item.at)}</p>
                          </div>
                          <p className="mt-1 text-slate-600">{item.detail}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reassignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Reassign Request</h2>
              <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={closeReassignModal}>Close</button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p><span className="font-semibold">Opportunity:</span> {reassignModal.request?.opportunity_name}</p>
              <p><span className="font-semibold">Topic:</span> {reassignModal.request?.topic}</p>
              <p><span className="font-semibold">Current Status:</span> {reassignModal.request?.status}</p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">AI Suggested SMEs</h3>
                {reassignModal.loading ? (
                  <p className="text-sm text-slate-500">Finding best matches...</p>
                ) : !reassignModal.suggestions.length ? (
                  <p className="text-sm text-slate-500">No AI suggestion found. Use manual selector.</p>
                ) : (
                  <div className="space-y-2">
                    {reassignModal.suggestions.map((item) => (
                      <button key={item.id} type="button" onClick={() => setReassignModal((current) => ({ ...current, selectedSmeId: item.id }))} className={`w-full rounded-md border p-3 text-left transition ${reassignModal.selectedSmeId === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-600">Score: {item.score}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.reason}</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Manual SME Selection</h3>
                <input className="mb-2 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="Search SME by name or skill" value={reassignModal.search} onChange={(e) => setReassignModal((current) => ({ ...current, search: e.target.value }))} />
                <div className="max-h-52 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
                  {filteredSmesForReassign.map((sme) => (
                    <button key={sme.id} type="button" onClick={() => setReassignModal((current) => ({ ...current, selectedSmeId: sme.id }))} className={`w-full rounded-md px-2 py-1 text-left text-sm ${reassignModal.selectedSmeId === sme.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-50'}`}>
                      {sme.name} {sme.clearance_level ? `- ${sme.clearance_level}` : ''}
                    </button>
                  ))}
                </div>

                <textarea className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="Optional reassignment note" value={reassignModal.note} onChange={(e) => setReassignModal((current) => ({ ...current, note: e.target.value }))} />
                <p className="mt-2 text-xs text-red-600">{reassignModal.message}</p>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" onClick={closeReassignModal}>Cancel</button>
                  <button type="button" disabled={!reassignModal.selectedSmeId || reassignModal.saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" onClick={applyReassignment}>
                    {reassignModal.saving ? 'Reassigning...' : 'Confirm Reassign'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
