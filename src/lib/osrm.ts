// Lightweight OSRM routing helper using the public router.project-osrm.org demo server.
// Returns a GeoJSON LineString + distance/duration for a driving route.

export interface OsrmRoute {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  steps: { instruction: string; distance: number; duration: number }[];
}

export async function fetchDrivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal
): Promise<OsrmRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) return null;
    const steps: OsrmRoute["steps"] = [];
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const m = s.maneuver || {};
        const type = m.type || "continue";
        const modifier = m.modifier ? ` ${m.modifier}` : "";
        const name = s.name ? ` onto ${s.name}` : "";
        steps.push({
          instruction: `${type}${modifier}${name}`.trim(),
          distance: s.distance || 0,
          duration: s.duration || 0,
        });
      }
    }
    return {
      geometry: route.geometry as GeoJSON.LineString,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
    };
  } catch {
    return null;
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}