import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRESSIVE_RADIUS_TIERS_KM,
  haversineKm,
  isValidCoordinatePair,
  minProviderDistanceKm
} from '../src/utils/geo.js';

test('isValidCoordinatePair rejects invalid, out-of-range, and null coordinates', () => {
  assert.equal(isValidCoordinatePair(null, null), false);
  assert.equal(isValidCoordinatePair(0, 0), false);
  assert.equal(isValidCoordinatePair(95, 88), false);
  assert.equal(isValidCoordinatePair(22.5726, 88.3639), true);
});

test('haversineKm computes accurate Kolkata to Howrah and Salt Lake distances', () => {
  // Esplanade Kolkata (22.5626, 88.3511) to Salt Lake Sector V (22.5767, 88.4316) ~ 8.4 km
  const saltLakeDist = haversineKm(22.5626, 88.3511, 22.5767, 88.4316);
  assert.ok(saltLakeDist !== null);
  assert.ok(saltLakeDist > 7 && saltLakeDist < 10, `Expected 7-10km, got ${saltLakeDist}`);

  // Missing GPS never invents distance
  assert.equal(haversineKm(22.5626, 88.3511, null, null), null);
});

test('minProviderDistanceKm picks nearest configured service area coordinate', () => {
  const dist = minProviderDistanceKm(22.5726, 88.3639, [
    { latitude: 23.2324, longitude: 87.8615 }, // Bardhaman (~95km)
    { latitude: 22.5958, longitude: 88.2636 } // Howrah (~10.6km)
  ]);
  assert.ok(dist !== null && dist < 15);
  assert.deepEqual(PROGRESSIVE_RADIUS_TIERS_KM, [5, 10, 25, 50]);
});
