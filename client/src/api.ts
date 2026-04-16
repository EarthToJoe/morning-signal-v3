import { getAccessToken } from './auth';

const API_BASE = '/api';

function getGuestId(): string {
  let guestId = localStorage.getItem('ms-guest-id');
  if (!guestId) {
    guestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('ms-guest-id', guestId);
  }
  return guestId;
}

export function hasUsedGuestTrial(): boolean {
  return localStorage.getItem('ms-guest-used') === 'true';
}

export function markGuestTrialUsed(): void {
  localStorage.setItem('ms-guest-used', 'true');
}

export async function api(method: string, path: string, body?: any) {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['X-Guest-Id'] = getGuestId();
  }
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}
