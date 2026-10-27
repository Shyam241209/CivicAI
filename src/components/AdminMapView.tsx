import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation2, Clock, AlertTriangle, CheckCircle2, X, Route, Search, RefreshCw, WifiOff, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedImageUrl } from "@/lib/storageUrl";
import { StorageImage } from "@/components/StorageImage";
import { AssignDepartmentDialog } from "@/components/admin/AssignDepartmentDialog";
import { fetchDrivingRoute, formatDistance, formatDuration, type OsrmRoute } from "@/lib/osrm";

interface Report {
  id: string;
  user_id?: string | null;
  user_description: string;
  short_description?: string | null;
  issue_category: string;
  severity: string;
  priority_level?: string | null;
  status: string;
  location_data: { lat: number; lng: number; address?: string } | null;
  image_url: string;
  created_at: string;
  assigned_department_id?: string | null;
  suggested_department?: string | null;
}

interface AdminMapViewProps {
  reports: Report[];
  onStatusUpdate: (reportId: string, status: string) => void;
  /** Called when Realtime detects a change so the parent can refetch. */
  onRefresh?: () => void;
}

const MUNICIPAL_OFFICE = { lat: 28.6139, lng: 77.209, name: "Municipal Corporation Office" };
const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  resolved: "#22c55e",
  rejected: "#6b7280",
  critical: "#dc2626",
};

const statusLabel = (s: string) =>
  ({ pending: "Pending", in_progress: "In Progress", resolved: "Resolved", rejected: "Rejected" } as Record<string, string>)[s] ||
  s ||
  "Pending";

const isCritical = (r: Report) => (r.severity || "").toLowerCase() === "critical" || (r.priority_level || "").toLowerCase() === "critical";

const markerColor = (r: Report) => (isCritical(r) ? STATUS_COLORS.critical : STATUS_COLORS[r.status || "pending"] || STATUS_COLORS.pending);

const hasValidCoords = (loc: Report["location_data"]): loc is { lat: number; lng: number; address?: string } =>
  loc !== null &&
  typeof loc.lat === "number" &&
  typeof loc.lng === "number" &&
  Number.isFinite(loc.lat) &&
  Number.isFinite(loc.lng) &&
  loc.lat >= -90 &&
  loc.lat <= 90 &&
  loc.lng >= -180 &&
  loc.lng <= 180;

const warnInvalidCoordinates = (reportId: string) => {
  if (import.meta.env.DEV) {
    console.warn(`[AdminMapView] Skipping report ${reportId}: invalid coordinates`);
  }
};

const isValidLngLat = (coordinate: readonly number[]): coordinate is [number, number] =>
  coordinate.length >= 2 &&
  typeof coordinate[0] === "number" &&
  typeof coordinate[1] === "number" &&
  Number.isFinite(coordinate[0]) &&
  Number.isFinite(coordinate[1]);

const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export const AdminMapView = ({ reports, onStatusUpdate, onRefresh }: AdminMapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initializedRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeSteps, setRouteSteps] = useState<OsrmRoute["steps"]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    if (!selectedReport) return;
    const refreshedReport = reports.find((report) => report.id === selectedReport.id);
    if (refreshedReport && refreshedReport !== selectedReport) setSelectedReport(refreshedReport);
  }, [reports, selectedReport]);

  const departmentName = useCallback(
    (id?: string | null) => departments.find((d) => d.id === id)?.name ?? null,
    [departments],
  );

  useEffect(() => {
    let active = true;
    supabase
      .from("departments")
      .select("id,name")
      .order("name")
      .then(({ data }) => {
        if (active && data) setDepartments(data);
      });
    return () => {
      active = false;
    };
  }, []);

  const reportsWithLocation = useMemo(
    () =>
      reports.filter(
        (report): report is Report & { location_data: { lat: number; lng: number; address?: string } } => {
          const valid = hasValidCoords(report.location_data);
          if (!valid) warnInvalidCoordinates(report.id);
          return valid;
        },
      ),
    [reports],
  );

  const visibleReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const windows: Record<string, number> = { today: 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5 };
    return reportsWithLocation.filter((r) => {
      if (statusFilter !== "all" && (r.status || "pending") !== statusFilter) return false;
      if (priorityFilter !== "all") {
        const p = (r.priority_level || r.severity || "").toLowerCase();
        if (p !== priorityFilter) return false;
      }
      if (departmentFilter !== "all") {
        if (departmentFilter === "unassigned" ? !!r.assigned_department_id : r.assigned_department_id !== departmentFilter)
          return false;
      }
      if (dateFilter !== "all" && windows[dateFilter]) {
        if (now - new Date(r.created_at).getTime() > windows[dateFilter]) return false;
      }
      if (q) {
        const hay = [r.id, r.short_description, r.user_description, r.issue_category, r.location_data?.address]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reportsWithLocation, statusFilter, priorityFilter, departmentFilter, dateFilter, search]);

  const reportIndex = useMemo(() => new Map(visibleReports.map((r) => [r.id, r])), [visibleReports]);
  const reportIndexRef = useRef(reportIndex);
  reportIndexRef.current = reportIndex;

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleReports.map((r) => ({
        type: "Feature" as const,
        id: r.id,
        properties: { id: r.id, color: markerColor(r) },
        geometry: { type: "Point" as const, coordinates: [r.location_data.lng, r.location_data.lat] },
      })),
    }),
    [visibleReports],
  );

  const handleSelect = useCallback((report: Report, fly = true) => {
    setSelectedReport(report);
    if (fly && mapRef.current && hasValidCoords(report.location_data)) {
      mapRef.current.flyTo({ center: [report.location_data.lng, report.location_data.lat], zoom: 15, duration: 700 });
    }
  }, []);

  const openAssignment = useCallback((report: Report) => {
    setSelectedReport(report);
    setAssignOpen(true);
    popupRef.current?.remove();
  }, []);

  const openPopup = useCallback(
    async (report: Report) => {
      const map = mapRef.current;
      if (!map || !hasValidCoords(report.location_data)) return;
      popupRef.current?.remove();

      const el = document.createElement("div");
      el.className = "admin-map-popup";
      el.style.minWidth = "240px";
      el.style.maxWidth = "260px";
      const dept = departmentName(report.assigned_department_id) || report.suggested_department || "Unassigned";
      el.innerHTML = `
        <div style="font-size:12px;line-height:1.45">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="width:9px;height:9px;border-radius:50%;background:${markerColor(report)}"></span>
            <strong>${escapeHtml(report.short_description || report.issue_category || "Civic issue")}</strong>
          </div>
          <div data-img style="margin-bottom:6px"></div>
          <div style="color:#475569;margin-bottom:6px">${escapeHtml((report.user_description || "").slice(0, 140))}</div>
          <div><b>ID:</b> ${escapeHtml(report.id.slice(0, 8))}</div>
          <div><b>Reporter:</b> ${escapeHtml(report.user_id ? report.user_id.slice(0, 8) : "Anonymous")}</div>
          <div><b>Department:</b> ${escapeHtml(dept)}</div>
          <div><b>Priority:</b> ${escapeHtml(report.priority_level || report.severity || "—")}</div>
          <div><b>Status:</b> ${escapeHtml(statusLabel(report.status))}</div>
          <div><b>Date:</b> ${escapeHtml(new Date(report.created_at).toLocaleDateString())}</div>
          <div><b>Location:</b> ${escapeHtml(
            report.location_data.address ||
              `${Number(report.location_data.lat).toFixed(4)}, ${Number(report.location_data.lng).toFixed(4)}`,
          )}</div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button data-assign style="flex:1;padding:5px 8px;border-radius:8px;background:#004687;color:#fff;font-weight:600">Assign</button>
            <button data-details style="flex:1;padding:5px 8px;border-radius:8px;border:1px solid #cbd5e1;font-weight:600">View Details</button>
          </div>
        </div>`;

      el.querySelector<HTMLButtonElement>("[data-assign]")?.addEventListener("click", () => {
        openAssignment(report);
      });
      el.querySelector<HTMLButtonElement>("[data-details]")?.addEventListener("click", () => {
        handleSelect(report, false);
        popupRef.current?.remove();
      });

      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px", offset: 14 })
        .setLngLat([report.location_data.lng, report.location_data.lat])
        .setDOMContent(el)
        .addTo(map);

      if (report.image_url) {
        const url = await getSignedImageUrl(report.image_url);
        const slot = el.querySelector<HTMLDivElement>("[data-img]");
        if (url && slot) {
          slot.innerHTML = `<img src="${escapeHtml(url)}" alt="Issue photo" style="width:100%;height:96px;object-fit:cover;border-radius:8px" />`;
        }
      }
    },
    [departmentName, handleSelect, openAssignment],
  );

  const openPopupRef = useRef(openPopup);
  openPopupRef.current = openPopup;

  // ---- Map initialization (exactly once per mount / retry) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;
    if (!navigator.onLine) {
      setMapError("Unable to load map. Check your connection.");
      return;
    }
    initializedRef.current = true;
    setMapReady(false);
    setMapError(null);

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [MUNICIPAL_OFFICE.lng, MUNICIPAL_OFFICE.lat],
        zoom: 9,
        attributionControl: { compact: true },
      });
    } catch {
      initializedRef.current = false;
      setMapError("Unable to load map. Check your connection.");
      return;
    }
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.dragRotate.disable();
    map.touchZoomRotate.enableRotation();

    const officeEl = document.createElement("div");
    Object.assign(officeEl.style, {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: "#004687",
      border: "3px solid white",
      boxShadow: "0 2px 8px rgba(0,0,0,.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    } as CSSStyleDeclaration);
    officeEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;
    new maplibregl.Marker({ element: officeEl })
      .setLngLat([MUNICIPAL_OFFICE.lng, MUNICIPAL_OFFICE.lat])
      .setPopup(new maplibregl.Popup().setHTML(`<strong>${MUNICIPAL_OFFICE.name}</strong>`))
      .addTo(map);

    const failTimer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) setMapError("Unable to load map. Check your connection.");
    }, 15_000);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    map.on("load", () => {
      window.clearTimeout(failTimer);
      setMapError(null);

      map.addSource("reports", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "report-clusters",
        type: "circle",
        source: "reports",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#004687",
          "circle-opacity": 0.85,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28, 200, 34],
        },
      });
      map.addLayer({
        id: "report-cluster-count",
        type: "symbol",
        source: "reports",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "report-points",
        type: "circle",
        source: "reports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "report-clusters", (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["report-clusters"] })[0];
        if (!feature) return;
        const source = map.getSource("reports") as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(feature.properties!.cluster_id as number).then((zoom) => {
          map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
      });

      map.on("click", "report-points", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const report = id ? reportIndexRef.current.get(id) : undefined;
        if (report) openPopupRef.current(report);
      });

      const pointer = (cursor: string) => () => {
        map.getCanvas().style.cursor = cursor;
      };
      ["report-points", "report-clusters"].forEach((layer) => {
        map.on("mouseenter", layer, pointer("pointer"));
        map.on("mouseleave", layer, pointer(""));
      });

      map.resize();
      setMapReady(true);
    });

    map.on("error", (event: { error?: Error }) => {
      const msg = event.error?.message || "";
      if (/fetch|network|NetworkError|Failed/i.test(msg) && !map.isStyleLoaded()) {
        setMapError("Unable to load map. Check your connection.");
      }
    });

    return () => {
      window.clearTimeout(failTimer);
      ro.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
      setMapReady(false);
    };
  }, [reloadKey]);

  // ---- Push filtered data into the map source ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("reports") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(geojson as unknown as GeoJSON.FeatureCollection);
  }, [geojson, mapReady]);

  // ---- Fit bounds when the visible set changes size ----
  const fitSignature = visibleReports.length;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fitSignature === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    visibleReports.forEach((report) => {
      if (hasValidCoords(report.location_data)) {
        bounds.extend([report.location_data.lng, report.location_data.lat]);
      }
    });
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignature, mapReady]);

  // ---- Realtime: new reports and status changes ----
  useEffect(() => {
    if (!onRefresh) return;
    const channel = supabase
      .channel("admin-map-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "civic_reports" }, () => onRefresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  // ---- Offline recovery ----
  useEffect(() => {
    const onOnline = () => {
      if (!mapRef.current) setReloadKey((k) => k + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // ---- Route drawing ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const controller = new AbortController();

    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route")) map.removeSource("route");

    if (!showRoute || !selectedReport?.location_data) {
      setRouteInfo(null);
      setRouteSteps([]);
      return;
    }

    fetchDrivingRoute(
      { lat: MUNICIPAL_OFFICE.lat, lng: MUNICIPAL_OFFICE.lng },
      { lat: selectedReport.location_data.lat, lng: selectedReport.location_data.lng },
      controller.signal,
    ).then((route) => {
      if (!route || !mapRef.current || controller.signal.aborted) return;
      const routeCoordinates = route.geometry.coordinates.filter(isValidLngLat);
      if (routeCoordinates.length < 2) {
        if (import.meta.env.DEV) {
          console.warn(`[AdminMapView] Skipping route for report ${selectedReport.id}: invalid coordinates`);
        }
        return;
      }
      const routeGeometry: GeoJSON.LineString = {
        ...route.geometry,
        coordinates: routeCoordinates,
      };
      setRouteInfo({ distance: formatDistance(route.distanceMeters), duration: formatDuration(route.durationSeconds) });
      setRouteSteps(route.steps);
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: routeGeometry } });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#004687", "line-width": 5, "line-opacity": 0.85 },
      });
      const bounds = new maplibregl.LngLatBounds();
      routeCoordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 80, duration: 600 });
    });

    return () => controller.abort();
  }, [showRoute, selectedReport, mapReady]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDepartmentFilter("all");
    setDateFilter("all");
  };
  const filtersActive =
    !!search || statusFilter !== "all" || priorityFilter !== "all" || departmentFilter !== "all" || dateFilter !== "all";

  const statusIcon = (status: string) => {
    if (status === "resolved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === "in_progress") return <Clock className="w-4 h-4 text-blue-600" />;
    return <AlertTriangle className="w-4 h-4 text-orange-600" />;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues, area, ID…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any date</SelectItem>
            <SelectItem value="today">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {visibleReports.length} of {reportsWithLocation.length} mapped issues
        </span>
        {filtersActive && (
          <button className="text-primary hover:underline" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map */}
        <div className="relative w-full shrink-0 lg:flex-1 min-w-0 h-[420px] sm:h-[520px] lg:h-[600px] rounded-xl overflow-hidden border-2 border-primary/20 bg-muted">
          {/* IMPORTANT: maplibre-gl.css forces position:relative on the map root, so the
              container must size itself with h-full/w-full instead of absolute inset-0. */}
          <div ref={containerRef} className="h-full w-full" />

          {!mapReady && !mapError && (
            <div className="absolute inset-0 z-20 p-4 bg-background/85 backdrop-blur-sm">
              <div className="h-full w-full flex flex-col gap-3">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="flex-1 w-full rounded-xl" />
                <p className="text-xs text-center text-muted-foreground">Loading map…</p>
              </div>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/95 px-6 text-center">
              <WifiOff className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{mapError}</p>
              <Button
                onClick={() => {
                  setMapError(null);
                  setReloadKey((k) => k + 1);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
            </div>
          )}

          {/* Legend */}
          {mapReady && (
            <div className="absolute bottom-3 left-3 z-10 bg-background/95 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Legend</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-[240px]">
                {[
                  ["Pending", STATUS_COLORS.pending],
                  ["In Progress", STATUS_COLORS.in_progress],
                  ["Resolved", STATUS_COLORS.resolved],
                  ["Rejected", STATUS_COLORS.rejected],
                  ["Critical", STATUS_COLORS.critical],
                ].map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {routeInfo && (
            <div className="absolute top-3 left-3 z-10 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-primary/10">
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-primary">{routeInfo.distance}</p>
                  <p className="text-xs text-muted-foreground">Est. {routeInfo.duration}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Issue list */}
        <Card className="w-full lg:w-80 lg:flex-shrink-0 border-2 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Reported Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] lg:h-[500px] px-4">
              <div className="space-y-3 pb-4">
                {visibleReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {reportsWithLocation.length === 0 ? "No issues with location data" : "No issues match the active filters"}
                  </p>
                ) : (
                  visibleReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => {
                        handleSelect(report);
                        openPopup(report);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedReport?.id === report.id
                          ? "border-accent bg-accent/5 shadow-md"
                          : "border-primary/10 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {statusIcon(report.status)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {report.priority_level || report.severity}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(report);
                            setShowRoute(true);
                          }}
                        >
                          <Route className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">{report.short_description || report.user_description}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{report.location_data?.address || "Location available"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detail drawer */}
      {selectedReport && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background shadow-2xl z-50 flex flex-col">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-background to-[#046A38]" />
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-primary">Issue Details</h3>
            <Button size="sm" variant="ghost" onClick={() => { setSelectedReport(null); setShowRoute(false); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {selectedReport.image_url && (
                <StorageImage path={selectedReport.image_url} alt="Issue" className="w-full h-48 object-cover rounded-lg" />
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{selectedReport.priority_level || selectedReport.severity}</Badge>
                <Badge variant="outline">{selectedReport.issue_category}</Badge>
                <Badge variant="secondary">{statusLabel(selectedReport.status)}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{selectedReport.user_description}</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">ID:</span> {selectedReport.id.slice(0, 8)}</p>
                <p><span className="font-medium text-foreground">Department:</span> {departmentName(selectedReport.assigned_department_id) || selectedReport.suggested_department || "Unassigned"}</p>
                <p><span className="font-medium text-foreground">Location:</span> {selectedReport.location_data?.address || "—"}</p>
              </div>
              {showRoute && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                    <Route className="w-4 h-4" />
                    Route ({routeInfo?.distance ?? "…"} · {routeInfo?.duration ?? "…"})
                  </div>
                  {routeSteps.length > 0 && (
                    <ol className="mt-2 space-y-1 text-xs text-muted-foreground max-h-48 overflow-y-auto pr-1">
                      {routeSteps.slice(0, 20).map((s, i) => (
                        <li key={i} className="flex justify-between gap-2 border-b border-border/50 pb-1 last:border-b-0">
                          <span className="capitalize">{s.instruction}</span>
                          <span className="shrink-0">{Math.round(s.distance)} m</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {new Date(selectedReport.created_at).toLocaleDateString()}
              </div>
            </div>
          </ScrollArea>
          <div className="p-4 border-t space-y-2">
            <Button className="w-full" onClick={() => setShowRoute((v) => !v)}>
              <Navigation2 className="w-4 h-4 mr-2" />
              {showRoute ? "Hide Route" : "Show Route to Issue"}
            </Button>
            <Button className="w-full" onClick={() => openAssignment(selectedReport)}>
              <Building2 className="w-4 h-4 mr-2" />
              {selectedReport.assigned_department_id ? "Reassign" : "Assign"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onStatusUpdate(selectedReport.id, "in_progress")}>
              Mark In Progress
            </Button>
          </div>
        </div>
      )}

      <AssignDepartmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        reportIds={selectedReport ? [selectedReport.id] : []}
        onAssigned={onRefresh}
      />
    </div>
  );
};

export default AdminMapView;
