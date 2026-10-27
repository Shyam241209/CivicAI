import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

type IssueFeature = Supercluster.PointFeature<{ issue: CivicIssue }>;
type IssueSuperclusterFeature = IssueFeature | Supercluster.ClusterFeature<{ issue: CivicIssue }>;

export interface CivicIssue {
  id: string;
  location_data: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  issue_category: string;
  severity: string;
  short_description: string;
  status: string;
  created_at: string;
  image_url?: string;
}

interface MapClusterViewProps {
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  showHeatmap: boolean;
  highlightIssueId?: string | null;
  freshIssueIds?: Set<string>;
  routeGeometry?: GeoJSON.LineString | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  moderate: "#f59e0b",
  minor: "#10b981",
};

const warnInvalidCoordinates = (reportId: string) => {
  if (import.meta.env.DEV) {
    console.warn(`[MapClusterView] Skipping report ${reportId}: invalid coordinates`);
  }
};

const isValidLngLat = (coordinate: readonly number[]): coordinate is [number, number] =>
  coordinate.length >= 2 &&
  typeof coordinate[0] === "number" &&
  typeof coordinate[1] === "number" &&
  Number.isFinite(coordinate[0]) &&
  Number.isFinite(coordinate[1]);

export function MapClusterView({
  issues,
  onSelectIssue,
  showHeatmap,
  highlightIssueId,
  freshIssueIds,
  routeGeometry,
}: MapClusterViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);
  const hasFitInitialBoundsRef = useRef(false);
  const [tileError, setTileError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { isDark } = useTheme();

  const hasValidCoords = (loc: CivicIssue["location_data"]): loc is { lat: number; lng: number; address?: string } =>
    loc !== null &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    loc.lat >= -90 &&
    loc.lat <= 90 &&
    loc.lng >= -180 &&
    loc.lng <= 180;

  const validIssues = useMemo(
    () => issues.filter((issue) => {
      const valid = hasValidCoords(issue.location_data);
      if (!valid) warnInvalidCoordinates(issue.id);
      return valid;
    }),
    [issues]
  );

  // Build the cluster index once per data change, not on every pan/zoom.
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<{ issue: CivicIssue }>({ radius: 60, maxZoom: 14 });
    index.load(
      validIssues.map((issue) => ({
        type: "Feature",
        properties: { issue },
        geometry: {
          type: "Point",
          coordinates: [issue.location_data.lng, issue.location_data.lat],
        },
      })) as IssueFeature[]
    );
    return index;
  }, [validIssues]);
  const indexRef = useRef(clusterIndex);
  indexRef.current = clusterIndex;

  const style = isDark
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/bright";

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style,
      center: [78.14, 11.65],
      zoom: 5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), "top-right");
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);
    const loadTimeout = window.setTimeout(() => {
      if (!readyRef.current) setTileError(true);
    }, 15_000);
    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      readyRef.current = true;
      setMapLoaded(true);
      map.resize();
      renderMarkers();
    });
    map.on("error", (e: maplibregl.ErrorEvent) => {
      // Tile/style fetch failures shouldn't leave a blank grey box.
      if (e?.error?.status >= 400 || e?.error?.message?.includes("Failed to fetch")) {
        setTileError(true);
      }
    });
    map.on("moveend", renderMarkers);
    map.on("zoomend", renderMarkers);

    return () => {
      readyRef.current = false;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      window.clearTimeout(loadTimeout);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // swap style on theme change
  useEffect(() => {
    if (mapRef.current && readyRef.current) {
      mapRef.current.setStyle(style);
    }
  }, [style]);

  const renderMarkers = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showHeatmap) {
      // simple density visualization: colored translucent circles
      validIssues.forEach((issue) => {
        const color = SEVERITY_COLORS[issue.severity] || "#6b7280";
        const el = document.createElement("div");
        el.style.cssText = `width:40px;height:40px;border-radius:50%;background:${color};opacity:0.35;pointer-events:none;`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([issue.location_data.lng, issue.location_data.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
      return;
    }

    // Build clusters
    const zoom = Math.round(map.getZoom());
    const b = map.getBounds();
    const bbox: [number, number, number, number] = [
      b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
    ];
    const index = indexRef.current;
    const clusters = index.getClusters(bbox, zoom);

    clusters.forEach((c: IssueSuperclusterFeature) => {
      const [lng, lat] = c.geometry.coordinates;
      const el = document.createElement("div");
      if (c.properties.cluster) {
        const count = c.properties.point_count as number;
        const size = count < 10 ? 34 : count < 50 ? 42 : 52;
        el.style.cssText = `
          width:${size}px;height:${size}px;border-radius:50%;
          background:hsl(var(--primary));color:hsl(var(--primary-foreground));
          display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:13px;border:3px solid #fff;
          box-shadow:0 4px 12px rgba(0,0,0,0.2);cursor:pointer;`;
        el.textContent = String(count);
        el.onclick = () => {
          const expZoom = index.getClusterExpansionZoom(c.properties.cluster_id);
          map.easeTo({ center: [lng, lat], zoom: Math.min(expZoom, 15) });
        };
      } else {
        const issue: CivicIssue = c.properties.issue;
        const color = SEVERITY_COLORS[issue.severity] || "#6b7280";
        const isFresh = freshIssueIds?.has(issue.id);
        el.style.cssText = `
          width:18px;height:18px;border-radius:50%;background:${color};
          border:${isFresh ? 4 : 3}px solid ${isFresh ? "#6366f1" : "#ffffff"};
          box-shadow:0 2px 6px rgba(0,0,0,0.25);cursor:pointer;
          ${isFresh ? "animation:pulse 1.5s infinite;" : ""}`;
        el.onclick = () => {
          onSelectIssue(issue);
          map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14) });
        };
      }
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds initial
    if (validIssues.length > 0 && zoom <= 5 && !hasFitInitialBoundsRef.current) {
      // Set the guard before fitBounds because it synchronously leads to
      // move/zoom events that call renderMarkers again.
      hasFitInitialBoundsRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      validIssues.forEach((i) =>
        bounds.extend([i.location_data.lng, i.location_data.lat])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 500 });
    }
  };

  useEffect(() => {
    if (!readyRef.current) return;
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, showHeatmap, freshIssueIds]);

  useEffect(() => {
    if (!highlightIssueId || !mapRef.current) return;
    const issue = validIssues.find((i) => i.id === highlightIssueId);
    if (issue && hasValidCoords(issue.location_data)) {
      mapRef.current.flyTo({
        center: [issue.location_data.lng, issue.location_data.lat],
        zoom: 15,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIssueId]);

  // Route overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("civic-route")) map.removeLayer("civic-route");
    if (map.getSource("civic-route")) map.removeSource("civic-route");
    if (!routeGeometry) return;
    const routeCoordinates = routeGeometry.coordinates.filter(isValidLngLat);
    if (routeCoordinates.length < 2) {
      if (import.meta.env.DEV) {
        console.warn("[MapClusterView] Skipping route: invalid coordinates");
      }
      return;
    }
    map.addSource("civic-route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { ...routeGeometry, coordinates: routeCoordinates },
      },
    });
    map.addLayer({
      id: "civic-route",
      type: "line",
      source: "civic-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#2554A5", "line-width": 5, "line-opacity": 0.85 },
    });
    const bounds = new maplibregl.LngLatBounds();
    routeCoordinates.forEach((coordinate) => bounds.extend(coordinate));
    map.fitBounds(bounds, { padding: 80, duration: 600 });
  }, [routeGeometry]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[350px] md:h-[500px] lg:h-[600px] rounded-xl overflow-hidden"
      />
      {!mapLoaded && !tileError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 backdrop-blur-sm">
          <span className="text-sm text-muted-foreground animate-pulse">Loading map…</span>
        </div>
      )}
      {tileError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/90 text-center px-6">
          <p className="text-sm text-muted-foreground">
            Map tiles could not be loaded. Check your connection.
          </p>
          <Button
            onClick={() => {
              setTileError(false);
              setMapLoaded(false);
              mapRef.current?.setStyle(style);
            }}
          >
            Retry map
          </Button>
        </div>
      )}
    </div>
  );
}