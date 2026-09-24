const TOKEN_KEY = 'tracker-indexer:admin-token';
const BASE = '/api/admin';

export const token = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set(value) {
    try {
      localStorage.setItem(TOKEN_KEY, value);
    } catch {}
  },
};

export class AuthError extends Error {
  constructor(message, tokenRequired) {
    super(message);
    this.tokenRequired = tokenRequired;
  }
}

async function request(method, path, body) {
  const headers = {};
  if (token.get()) headers.Authorization = `Bearer ${token.get()}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) throw new AuthError(data.error, data.tokenRequired);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  status: () => request('GET', '/status'),
  settings: () => request('GET', '/settings'),
  saveSettings: (patch) => request('PUT', '/settings', patch),
  resetSettings: () => request('DELETE', '/settings'),
  startJob: (job, options = {}) => request('POST', `/jobs/${job}`, options),
  cancelJob: () => request('DELETE', '/jobs/current'),
  clearSource: (name) => request('DELETE', `/sources/${encodeURIComponent(name)}/items`),
  checkSource: (name) => request('POST', `/sources/${encodeURIComponent(name)}/check`),
  setupStatus: () => request('GET', '/setup'),
  createAdminToken: (value) => request('POST', '/setup', { token: value }),
};

/** EventSource cannot send headers, so the token goes in the query string. */
export function openEvents({ onOpen, onError, onStatus, onSchedule, onLog }) {
  const query = token.get() ? `?token=${encodeURIComponent(token.get())}` : '';
  const events = new EventSource(`${BASE}/events${query}`);

  events.addEventListener('open', onOpen);
  events.addEventListener('error', onError);
  events.addEventListener('status', (event) => onStatus(JSON.parse(event.data)));
  events.addEventListener('log', (event) => onLog(JSON.parse(event.data)));
  events.addEventListener('schedule', (event) => onSchedule(JSON.parse(event.data)));
  return events;
}
