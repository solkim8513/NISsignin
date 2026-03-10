const ENV_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

function getRuntimeApiBase() {
  if (typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);
  const queryApiBase = (params.get('apiBase') || '').trim();
  if (queryApiBase) {
    localStorage.setItem('nis_api_base_url', queryApiBase);
  }

  return (localStorage.getItem('nis_api_base_url') || '').trim();
}

const API_BASE = (getRuntimeApiBase() || ENV_API_BASE).replace(/\/$/, '');

function isGitHubPagesHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase().endsWith('github.io');
}

function ensureApiBaseForHostedPages(path) {
  if (!API_BASE && isGitHubPagesHost() && path.startsWith('/api/')) {
    throw new Error(
      JSON.stringify({
        error:
          'Backend API URL is not configured for this GitHub Pages site. Ask admin to set VITE_API_BASE_URL (HTTPS backend URL) and redeploy.'
      })
    );
  }
}

function headers(withJson = true) {
  const token = localStorage.getItem('token');
  const h = {};
  if (withJson) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiGet(path) {
  ensureApiBaseForHostedPages(path);
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(false) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body, isForm = false) {
  ensureApiBaseForHostedPages(path);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: isForm ? headers(false) : headers(true),
    body: isForm ? body : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPut(path, body) {
  ensureApiBaseForHostedPages(path);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path) {
  ensureApiBaseForHostedPages(path);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: headers(false)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export { API_BASE };
