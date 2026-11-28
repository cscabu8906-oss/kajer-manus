import type {
  AdminLocationSummary,
  DistrictBookingStat,
  ProviderEarningsSummary,
  ProviderSearchMeta,
  ServiceAreaItem,
  WbDistrict,
  WbGpWard,
  WbLocalBody,
  WbState,
  WbSubdivision,
  WbVillage,
  WorkerProfile
} from '../types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://api.kajermanus.in/api/v1').replace(/\/$/, '');
export const API_ORIGIN = API_BASE.replace(/\/api\/v1$/, '');
const TOKEN_KEY = 'km_auth_token';

export function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
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

export async function uploadPreAuthAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE}/uploads/avatar`, {
    method: 'POST',
    body: form,
    credentials: 'include'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Avatar upload failed');
  }
  return String(payload.url || '');
}

export async function uploadImages(
  files: File[],
  folder: 'avatars' | 'portfolio' | 'kyc' | 'bookings'
): Promise<string[]> {
  if (!files.length) return [];
  const token = getStoredToken();
  const form = new FormData();
  form.append('folder', folder);
  files.forEach((file) => form.append('files', file));
  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: 'include'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Image upload failed');
  }
  return Array.isArray(payload.urls) ? payload.urls : payload.url ? [String(payload.url)] : [];
}

export const locationsApi = {
  getStates: () => apiRequest<{ states: WbState[] }>('/locations/states'),
  getDistricts: () => apiRequest<{ districts: WbDistrict[] }>('/locations/districts'),
  getSubdivisions: (districtId: string) =>
    apiRequest<{ subdivisions: WbSubdivision[] }>(`/locations/subdivisions?districtId=${encodeURIComponent(districtId)}`),
  getLocalBodies: (params: { districtId?: string; subdivisionId?: string; areaType?: string }) => {
    const qs = new URLSearchParams();
    if (params.districtId) qs.set('districtId', params.districtId);
    if (params.subdivisionId) qs.set('subdivisionId', params.subdivisionId);
    if (params.areaType) qs.set('areaType', params.areaType);
    return apiRequest<{ localBodies: WbLocalBody[] }>(`/locations/local-bodies?${qs.toString()}`);
  },
  getGpWards: (localBodyId: string, unitType?: 'gp' | 'ward') => {
    const qs = new URLSearchParams({ localBodyId });
    if (unitType) qs.set('unitType', unitType);
    return apiRequest<{ gpWards: WbGpWard[] }>(`/locations/gp-wards?${qs.toString()}`);
  },
  getVillages: (params: { gpWardId?: string; localBodyId?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params.gpWardId) qs.set('gpWardId', params.gpWardId);
    if (params.localBodyId) qs.set('localBodyId', params.localBodyId);
    if (params.q) qs.set('q', params.q);
    return apiRequest<{ villages: WbVillage[] }>(`/locations/villages?${qs.toString()}`);
  },
  lookupByPincode: (pincode: string) =>
    apiRequest<{
      pincode: string;
      districtId: string | null;
      subdivisionId: string | null;
      localBodyId: string | null;
      gpWardId: string | null;
      villageId: string | null;
      areaType: 'urban' | 'rural' | null;
      latitude: number | null;
      longitude: number | null;
      matches: Array<Record<string, unknown>>;
    }>(`/locations/by-pincode/${encodeURIComponent(pincode)}`)
};

export const providerSearchApi = {
  search: (params: Record<string, string | number | boolean | undefined | null>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        qs.set(k, String(v));
      }
    });
    return apiRequest<{ providers: WorkerProfile[]; searchMeta: ProviderSearchMeta }>(
      `/providers/search?${qs.toString()}`
    );
  },
  toggleFavourite: (providerUserId: string, nextFavourite: boolean) =>
    apiRequest(`/users/me/favourites/${encodeURIComponent(providerUserId)}`, {
      method: nextFavourite ? 'POST' : 'DELETE'
    }),
  getEarnings: () =>
    apiRequest<{ earnings: ProviderEarningsSummary; recentCompleted: Array<Record<string, unknown>> }>(
      '/provider/earnings'
    ),
  saveServiceAreas: (areas: ServiceAreaItem[]) =>
    apiRequest<{ serviceAreas: ServiceAreaItem[] }>('/provider/me/service-areas', {
      method: 'PUT',
      body: JSON.stringify({ areas })
    })
};

export const adminLocationsApi = {
  getSummary: () => apiRequest<{ summary: AdminLocationSummary }>('/admin/locations/summary'),
  getStats: () =>
    apiRequest<{ byDistrict: DistrictBookingStat[]; byLocalBody: Array<Record<string, unknown>> }>(
      '/admin/locations/stats'
    ),
  list: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    return apiRequest<{ items: Array<Record<string, unknown>> }>(`/admin/locations/list?${qs.toString()}`);
  },
  upsert: (tier: string, payload: Record<string, unknown>) =>
    apiRequest<{ item: Record<string, unknown> }>(`/admin/locations/${encodeURIComponent(tier)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  update: (tier: string, id: string, payload: Record<string, unknown>) =>
    apiRequest<{ item: Record<string, unknown> }>(
      `/admin/locations/${encodeURIComponent(tier)}/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    )
};

export const toLocaleDigits = (value: number | string, lang: 'bn' | 'en') =>
  lang === 'bn'
    ? String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])
    : String(value);

export const formatInr = (amount: number, lang: 'bn' | 'en') =>
  `₹${toLocaleDigits(amount.toLocaleString('en-IN'), lang)}`;
