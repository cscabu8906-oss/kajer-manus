// Pure geospatial distance utilities (Haversine formula on WGS-84 Earth radius)
// Never invents or simulates distances; returns null when valid coordinates are absent.

const EARTH_RADIUS_KM = 6371;

export function isValidCoordinatePair(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false;
  if (la === 0 && ln === 0) return false;
  return true;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  if (!isValidCoordinatePair(lat1, lng1) || !isValidCoordinatePair(lat2, lng2)) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Computes minimum real distance in KM between customer (lat, lng) and a provider's
 * primary GPS coordinates or any configured service area coordinates.
 */
export function minProviderDistanceKm(customerLat, customerLng, providerPoints = []) {
  if (!isValidCoordinatePair(customerLat, customerLng)) return null;
  let best = null;
  for (const pt of providerPoints) {
    if (!pt) continue;
    const d = haversineKm(customerLat, customerLng, pt.latitude ?? pt.lat, pt.longitude ?? pt.lng);
    if (d !== null && (best === null || d < best)) {
      best = d;
    }
  }
  return best;
}

export const PROGRESSIVE_RADIUS_TIERS_KM = [5, 10, 25, 50];
