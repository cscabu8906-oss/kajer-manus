const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://api.kajermanus.in/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'km_auth_token';

export function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const toLocaleDigits = (value: number | string, lang: 'bn' | 'en') =>
  lang === 'bn'
    ? String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])
    : String(value);

export const formatInr = (amount: number, lang: 'bn' | 'en') =>
  `₹${toLocaleDigits(amount.toLocaleString('en-IN'), lang)}`;

