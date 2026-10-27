export interface ReverseGeocodeDetails {
  displayName: string;
  primaryName: string;
  building?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS: HeadersInit = { "Accept-Language": "en", "User-Agent": "CivicAI/1.0" };

function detailsFromNominatim(r: any): ReverseGeocodeDetails {
  const a = r.address || {};
  const building = a.house_number || a.building;
  const street = a.road || a.pedestrian || a.footway;
  const area = a.neighbourhood || a.suburb || a.village || a.hamlet;
  const city = a.city || a.town || a.municipality || a.county;
  const state = a.state;
  const postcode = a.postcode;
  const country = a.country;
  const primaryName =
    building && street ? `${building} ${street}` :
    street || area || city || state || (r.display_name?.split(",")[0]?.trim() ?? "");
  return {
    displayName: r.display_name || `${primaryName}`,
    primaryName,
    building, street, area, city, state, postcode, country,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const d = await reverseGeocodeDetails(lat, lng);
  return d?.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export async function reverseGeocodeDetails(lat: number, lng: number): Promise<ReverseGeocodeDetails | null> {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json) return null;
    return detailsFromNominatim(json);
  } catch { return null; }
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  primaryName?: string;
  secondaryName?: string;
}

export interface ForwardGeocodeBias {
  center?: { lat: number; lng: number };
  viewbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  bounded?: boolean;
}

export const HOSUR_BIAS: ForwardGeocodeBias = {
  center: { lat: 12.7409, lng: 77.8253 },
  viewbox: { minLng: 77.55, minLat: 12.55, maxLng: 78.10, maxLat: 12.95 },
  bounded: false,
};

function toResult(r: any): ForwardGeocodeResult | null {
  const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const parts = (r.display_name || "").split(",").map((s: string) => s.trim());
  const primary = r.name || parts[0] || r.display_name;
  const secondary = parts.slice(1).join(", ");
  return { lat, lng, displayName: r.display_name || primary, primaryName: primary, secondaryName: secondary };
}

export async function forwardGeocode(query: string): Promise<ForwardGeocodeResult | null> {
  const list = await forwardGeocodeMany(query, 1);
  return list[0] || null;
}

export async function forwardGeocodeMany(
  query: string,
  limit = 10,
  signal?: AbortSignal,
  bias?: ForwardGeocodeBias
): Promise<ForwardGeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q,
      limit: String(Math.min(limit, 20)),
      addressdetails: "1",
      countrycodes: "in",
    });
    if (bias?.viewbox) {
      const vb = bias.viewbox;
      params.set("viewbox", `${vb.minLng},${vb.maxLat},${vb.maxLng},${vb.minLat}`);
      if (bias.bounded) params.set("bounded", "1");
    }
    const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: HEADERS, signal });
    if (!res.ok) return [];
    const json = await res.json();
    const list: ForwardGeocodeResult[] = (Array.isArray(json) ? json : [])
      .map(toResult).filter((x): x is ForwardGeocodeResult => x !== null);
    if (bias?.center) {
      const c = bias.center;
      list.sort((a, b) => haversineKm(c, a) - haversineKm(c, b));
    }
    return list.slice(0, limit);
  } catch { return []; }
}