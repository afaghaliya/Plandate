/**
 * Geo utilities. Geocoding goes through a provider seam: a bundled gazetteer
 * of Indian cities answers instantly and offline, with OpenStreetMap Nominatim
 * as the network fallback. Swap `geocode` for Google/Mapbox by replacing the
 * body of `remoteGeocode`.
 */

export type GeoPoint = { lat: number; lng: number };

export type GeocodeResult = GeoPoint & {
  name: string;
  source: "gazetteer" | "nominatim";
};

/** Cities the seeded activity catalogue covers, plus common nearby anchors. */
export const GAZETTEER: Record<string, GeoPoint> = {
  kochi: { lat: 9.9312, lng: 76.2673 },
  "fort kochi": { lat: 9.9658, lng: 76.2422 },
  ernakulam: { lat: 9.9816, lng: 76.2999 },
  munnar: { lat: 10.0889, lng: 77.0595 },
  alleppey: { lat: 9.4981, lng: 76.3388 },
  alappuzha: { lat: 9.4981, lng: 76.3388 },
  varkala: { lat: 8.7379, lng: 76.7163 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  trivandrum: { lat: 8.5241, lng: 76.9366 },
  kovalam: { lat: 8.4004, lng: 76.9787 },
  wayanad: { lat: 11.6854, lng: 76.132 },
  kozhikode: { lat: 11.2588, lng: 75.7804 },
  calicut: { lat: 11.2588, lng: 75.7804 },
  thrissur: { lat: 10.5276, lng: 76.2144 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  delhi: { lat: 28.6139, lng: 77.209 },
  goa: { lat: 15.2993, lng: 74.124 },
  panaji: { lat: 15.4909, lng: 73.8278 },
};

export function normalisePlace(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Best-effort city key for an arbitrary location string. */
export function cityKey(input: string): string {
  const norm = normalisePlace(input);
  if (GAZETTEER[norm]) return norm;
  const parts = norm.split(/,\s*/);
  for (const part of parts) {
    if (GAZETTEER[part]) return part;
  }
  for (const key of Object.keys(GAZETTEER)) {
    if (norm.includes(key)) return key;
  }
  return parts[0] ?? norm;
}

async function remoteGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: { "User-Agent": "Planadate/0.1 (outing planner)" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = json[0];
    if (!hit) return null;
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      name: hit.display_name.split(",")[0]?.trim() || query,
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const key = cityKey(query);
  const local = GAZETTEER[key];
  if (local) {
    return { ...local, name: titleCase(key), source: "gazetteer" };
  }
  return remoteGeocode(query);
}

export function titleCase(input: string): string {
  return input.replace(/\b\w/g, (c) => c.toUpperCase());
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Rough city-traffic travel estimate; replaced by a routing API later. */
export function travelMinutes(km: number): number {
  if (km <= 0.6) return 0;
  if (km < 2) return Math.max(5, Math.round(km * 8));
  if (km < 15) return Math.round(km * 3.2);
  return Math.round(km * 1.6);
}

/**
 * Safety: never publish a precise personal coordinate. Discovery surfaces round
 * positions to a ~500m grid before they reach the client; the exact meeting
 * point is only the (already public) named venue.
 */
export function coarsen(point: GeoPoint, gridMeters = 500): GeoPoint {
  const latStep = gridMeters / 111_320;
  const lngStep = latStep / Math.max(0.2, Math.cos(toRad(point.lat)));
  return {
    lat: Math.round(point.lat / latStep) * latStep,
    lng: Math.round(point.lng / lngStep) * lngStep,
  };
}
