import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/hooks/useTheme";

interface Report {
  id: string;
  issue_category: string;
  severity: string;
  status: string;
  location_data: {
    lat?: number;
    lng?: number;
    address?: string;
  } | null;
}

interface CitizenMapPreviewProps {
  reports: Report[];
  selectedReportId?: string;
  onMarkerClick?: (reportId: string) => void;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
    case "high":
      return "#ef4444";
    case "moderate":
      return "#f59e0b";
    case "minor":
      return "#22c55e";
    default:
      return "#6b7280";
  }
};

const getStatusBorder = (status: string) => {
  switch (status) {
    case "resolved":
      return "#22c55e";
    case "in_progress":
      return "#3b82f6";
    default:
      return "#ffffff";
  }
};

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
    console.warn(`[CitizenMapPreview] Skipping report ${reportId}: invalid coordinates`);
  }
};

export const CitizenMapPreview = ({ reports, selectedReportId, onMarkerClick }: CitizenMapPreviewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { isDark } = useTheme();

  const reportsWithLocation = reports.filter((r) => {
    const valid = hasValidCoords(r.location_data);
    if (!valid) warnInvalidCoordinates(r.id);
    return valid;
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const first = reportsWithLocation[0];
    const center: [number, number] = first
      ? [first.location_data.lng, first.location_data.lat]
      : [78.14, 11.65];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: isDark
        ? "https://tiles.openfreemap.org/styles/dark"
        : "https://tiles.openfreemap.org/styles/bright",
      center,
      zoom: 10,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => map.resize());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    reportsWithLocation.forEach((report) => {
      if (!hasValidCoords(report.location_data)) return;
      const isSelected = report.id === selectedReportId;
      const fill = getSeverityColor(report.severity);
      const stroke = getStatusBorder(report.status);
      const el = document.createElement("div");
      const size = isSelected ? 22 : 16;
      el.style.cssText = `
        width:${size}px;height:${size}px;border-radius:50%;background:${fill};
        border:3px solid ${stroke};box-shadow:0 2px 6px rgba(0,0,0,0.25);
        cursor:pointer;z-index:${isSelected ? 999 : 1};`;
      el.onclick = () => onMarkerClick?.(report.id);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([report.location_data.lng, report.location_data.lat])
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    if (reportsWithLocation.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      reportsWithLocation.forEach((report) => {
        if (report.location_data?.lat && report.location_data?.lng) {
          bounds.extend([report.location_data.lng, report.location_data.lat]);
        }
      });
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 400 });
    }
  }, [reportsWithLocation, selectedReportId, onMarkerClick]);

  useEffect(() => {
    if (!mapRef.current || !selectedReportId) return;
    const selectedReport = reportsWithLocation.find((r) => r.id === selectedReportId);
    if (selectedReport && hasValidCoords(selectedReport.location_data)) {
      mapRef.current.flyTo({
        center: [selectedReport.location_data.lng, selectedReport.location_data.lat],
        zoom: 14,
      });
    }
  }, [reportsWithLocation, selectedReportId]);

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Your Reports Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainerRef} className="w-full h-[300px]" />
        
        {/* Legend */}
        <div className="p-3 border-t bg-muted/30">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span>Minor</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
