const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function headers(withJson = true) {
  const token = localStorage.getItem('token');
  const h = {};
  if (withJson) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(false) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body, isForm = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: isForm ? headers(false) : headers(true),
    body: isForm ? body : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: headers(false)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export { API_BASE };
