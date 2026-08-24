const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const CLIENT_SESSION_KEY = 'tasago_client_session_v1';
let runtimeApiBaseUrl: string | null = null;
let apiBaseResolved = false;
let sameOriginApiAvailable = !API_BASE_URL;

function requestUrl(path: string, baseUrl: string): string {
  return `${baseUrl}${path}`;
}

function getClientSessionToken(): string | null {
  try {
    return localStorage.getItem(CLIENT_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setClientSessionToken(token: unknown): void {
  if (typeof token !== 'string' || !token) return;
  try {
    localStorage.setItem(CLIENT_SESSION_KEY, token);
  } catch {
    // Cookie authentication remains the primary path when storage is unavailable.
  }
}

export function clearClientSessionToken(): void {
  try {
    localStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {}
}

function requestOptions(init: RequestInit = {}): RequestInit {
  const token = getClientSessionToken();
  return {
    ...init,
    cache: init.cache || 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  };
}

export function apiUrl(path: string): string {
  return requestUrl(path, runtimeApiBaseUrl ?? API_BASE_URL);
}

export function hasExternalApiBase(): boolean {
  return Boolean(API_BASE_URL);
}

export function useSameOriginApi(): void {
  runtimeApiBaseUrl = '';
  apiBaseResolved = true;
  sameOriginApiAvailable = true;
}

export function canUseSameOriginApi(): boolean {
  return sameOriginApiAvailable;
}

export async function resolveApiBase(): Promise<void> {
  if (apiBaseResolved) return;
  if (!API_BASE_URL) {
    sameOriginApiAvailable = true;
    apiBaseResolved = true;
    return;
  }
  try {
    const response = await sameOriginApiFetch('/api/health');
    const data = await response.json().catch(() => null);
    if (response.ok && data?.status === 'ok') {
      runtimeApiBaseUrl = '';
      sameOriginApiAvailable = true;
    }
  } catch {
    // Keep the configured external API when the current origin has no API route.
  } finally {
    apiBaseResolved = true;
  }
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), requestOptions(init));
}

export function formatApiError(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'details']) {
      const nested = formatApiError(candidate[key], '');
      if (nested) return nested;
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {}
  }
  return fallback;
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  return formatApiError(payload && typeof payload === 'object' ? (payload as Record<string, unknown>).error ?? (payload as Record<string, unknown>).message ?? payload : payload, fallback);
}

export function sameOriginApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(requestUrl(path, ''), requestOptions(init));
}

export function configuredApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(requestUrl(path, API_BASE_URL), requestOptions(init));
}
