// geo.js — approximate distance between two Canadian postal codes, used
// to decide whether a part qualifies for the 50km shipping option.
//
// This deliberately avoids needing a paid geocoding API key (Google Maps,
// etc.). It looks up each postal code's FSA (the first 3 characters, e.g.
// "V3T" from "V3T 2T3" — Canada Post's own unit for "a few square km to a
// few hundred", roughly a neighbourhood in a city) against api.zippopotam.us,
// a free public no-key-required lookup, and does a straight-line (haversine)
// distance between the two FSA centroids.
//
// This is an approximation, not a road-distance calculation, and it's only
// as reliable as that free third-party service's uptime — both acceptable
// trade-offs for a "does this look local?" checkout gate, but worth
// upgrading to Google's Distance Matrix API later if AFCA wants precise
// numbers or the free service becomes unreliable.

const FSA_CACHE = new Map(); // "V3T" -> { lat, lng } | null (null = lookup failed, cached briefly to avoid hammering the API)
const FSA_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — FSA centroids never move, but don't cache a transient failure forever

function extractFsa(postalCode) {
  if (!postalCode) return null;
  const cleaned = String(postalCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const fsa = cleaned.slice(0, 3);
  // Canadian FSA pattern: letter-digit-letter (e.g. V3T, M5V).
  return /^[A-Z][0-9][A-Z]$/.test(fsa) ? fsa : null;
}

async function lookupFsaLatLng(fsa) {
  const cached = FSA_CACHE.get(fsa);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value = null;
  try {
    const res = await fetch(`https://api.zippopotam.us/ca/${fsa.toLowerCase()}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const place = data.places && data.places[0];
      if (place) {
        value = { lat: Number(place.latitude), lng: Number(place.longitude) };
      }
    }
  } catch (err) {
    // Network hiccup or the service is down — treated the same as "unknown",
    // callers fall back to pickup-only rather than failing the whole request.
    value = null;
  }
  FSA_CACHE.set(fsa, { value, expiresAt: Date.now() + FSA_CACHE_TTL_MS });
  return value;
}

function haversineKm(a, b) {
  const R = 6371; // Earth radius, km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Returns { eligible, distanceKm } — eligible is false (never true) when
// either postal code can't be resolved, since we'd rather under-offer
// shipping than promise a delivery distance we can't actually verify.
async function checkShippingEligibility(originPostalCode, destPostalCode, maxKm = 50) {
  const originFsa = extractFsa(originPostalCode);
  const destFsa = extractFsa(destPostalCode);
  if (!originFsa || !destFsa) {
    return { eligible: false, distanceKm: null, reason: "invalid_postal_code" };
  }
  const [origin, dest] = await Promise.all([lookupFsaLatLng(originFsa), lookupFsaLatLng(destFsa)]);
  if (!origin || !dest) {
    return { eligible: false, distanceKm: null, reason: "lookup_failed" };
  }
  const distanceKm = Math.round(haversineKm(origin, dest) * 10) / 10;
  return { eligible: distanceKm <= maxKm, distanceKm, reason: null };
}

module.exports = { checkShippingEligibility, extractFsa };
