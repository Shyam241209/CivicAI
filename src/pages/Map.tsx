import { StorageImage } from "@/components/StorageImage";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation2, Search, Flame, X, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { MapClusterView, type CivicIssue } from "@/components/MapClusterView";
import { fetchDrivingRoute, formatDistance, formatDuration } from "@/lib/osrm";

const Map = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [highlightIssueId, setHighlightIssueId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [freshIssueIds, setFreshIssueIds] = useState<Set<string>>(new Set());
  const [routeGeom, setRouteGeom] = useState<GeoJSON.LineString | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distance: string; duration: string } | null>(null);

  // Define fetchIssues BEFORE useEffect calls it
  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("civic_reports")
        .select(
          "id, status, issue_category, severity, priority_level, short_description, created_at, updated_at, suggested_department, assigned_department_id, location_data"
        );
      if (error) throw error;
      const validIssues = (data || [])
        .map((issue) => ({ ...issue, location_data: issue.location_data as CivicIssue["location_data"] }))
        .filter((issue) => {
          const location = issue.location_data;
          const valid = location &&
            typeof location === "object" &&
            typeof location.lat === "number" &&
            typeof location.lng === "number" &&
            Number.isFinite(location.lat) &&
            Number.isFinite(location.lng) &&
            location.lat >= -90 &&
            location.lat <= 90 &&
            location.lng >= -180 &&
            location.lng <= 180;
          if (!valid && import.meta.env.DEV) {
            console.warn(`[Map] Skipping report ${issue.id}: invalid coordinates`);
          }
          return valid;
        }) as CivicIssue[];
      setIssues(validIssues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      setLoadError("We couldn’t load map data. Check your connection and try again.");
      toast({ title: "Error", description: "Failed to load civic issues", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchIssues();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error:", err)
      );
    }
  }, [fetchIssues]);

  // Realtime subscription with stable dependency array
  useEffect(() => {
    const channel = supabase
      .channel("civic-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "civic_reports" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newIssue = payload.new as Record<string, unknown>;
            const locationData = newIssue.location_data;
            if (
              locationData &&
              typeof locationData === "object" &&
              typeof (locationData as any).lat === "number" &&
              typeof (locationData as any).lng === "number" &&
              Number.isFinite((locationData as any).lat) &&
              Number.isFinite((locationData as any).lng)
            ) {
              const mapped = { ...newIssue, location_data: locationData as CivicIssue["location_data"] } as CivicIssue;
              setIssues((prev) => [...prev, mapped]);
              setFreshIssueIds((prev) => new Set(prev).add(mapped.id));
              setTimeout(() => {
                setFreshIssueIds((prev) => {
                  const next = new Set(prev);
                  next.delete(mapped.id);
                  return next;
                });
              }, 30000);
              toast({ title: "🆕 New Report", description: String(newIssue.short_description || "A new civic issue was reported nearby") });
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Record<string, unknown>;
            setIssues((prev) =>
              prev.map((i) =>
                i.id === updated.id
                  ? ({ ...updated, location_data: updated.location_data } as CivicIssue)
                  : i
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as Record<string, unknown>;
            if (typeof deleted.id === "string") {
              setIssues((prev) => prev.filter((i) => i.id !== deleted.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const filteredIssues = useMemo(() => {
    let filtered = [...issues];
    if (categoryFilter !== "all") filtered = filtered.filter((i) => i.issue_category === categoryFilter);
    if (severityFilter !== "all") filtered = filtered.filter((i) => i.severity === severityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.short_description?.toLowerCase().includes(q) ||
          i.issue_category?.toLowerCase().includes(q) ||
          i.location_data?.address?.toLowerCase().includes(q) ||
          i.severity?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [issues, categoryFilter, severityFilter, searchQuery]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredIssues.slice(0, 5);
  }, [filteredIssues, searchQuery]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "moderate": return "default";
      default: return "secondary";
    }
  };

  const handleSelectSearchResult = useCallback((issue: CivicIssue) => {
    setSelectedIssue(issue);
    setHighlightIssueId(issue.id);
    setSearchQuery("");
    // Reset highlight after animation
    setTimeout(() => setHighlightIssueId(null), 1000);
  }, []);

  const showRouteToIssue = async (issue: CivicIssue) => {
    const lat = issue.location_data?.lat;
    const lng = issue.location_data?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast({ title: "Location unavailable", description: "This report has no coordinates to route to.", variant: "destructive" });
      return;
    }
    if (!userLocation) {
      toast({ title: "Location required", description: "Enable location access to draw a route.", variant: "destructive" });
      return;
    }
    const route = await fetchDrivingRoute(userLocation, { lat, lng });
    if (!route) {
      toast({ title: "Route unavailable", description: "Could not compute a driving route right now.", variant: "destructive" });
      return;
    }
    setRouteGeom(route.geometry);
    setRouteMeta({ distance: formatDistance(route.distanceMeters), duration: formatDuration(route.durationSeconds) });
  };

  const clearRoute = () => { setRouteGeom(null); setRouteMeta(null); };

  const categories = [...new Set(issues.map((i) => i.issue_category))];
  const severities = ["critical", "moderate", "minor"];

  if (isLoading) {
    return (
      <AppLayout overlay="medium">
        <div className="py-6 px-4">
          <div className="w-full mx-auto space-y-4">
            <p className="text-center text-sm font-medium text-muted-foreground">Loading map data…</p>
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-[400px] rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout overlay="medium">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Map data unavailable</h1>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
          <Button onClick={() => void fetchIssues()}>Retry</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout overlay="medium">
      <div className="py-6 md:py-8 px-4">
        <div className="w-full mx-auto">
          <div className="text-center mb-4 md:mb-8">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 md:mb-4">
              {t("mapTitle")}
            </h1>
            <p className="text-sm md:text-xl text-muted-foreground">{t("mapSubtitle")}</p>
          </div>

          {/* Search Bar */}
          <Card className="mb-4 rounded-2xl">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchIssuesPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && searchQuery.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {searchResults.map((issue) => (
                      <button
                        key={issue.id}
                        onClick={() => handleSelectSearchResult(issue)}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border last:border-b-0 flex items-start gap-3"
                      >
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: issue.severity === "critical" ? "#ef4444" : issue.severity === "moderate" ? "#f59e0b" : "#10b981" }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{issue.short_description}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {issue.issue_category} • {issue.location_data?.address || "No address"}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredIssues.length > 5 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/30">
                        {filteredIssues.length - 5} more results
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filters + Heatmap Toggle */}
          <Card className="mb-4 md:mb-6 rounded-2xl">
            <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                  {t("filterBy")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <Label htmlFor="heatmap-toggle" className="text-sm cursor-pointer">
                    {t("heatmap")}
                  </Label>
                  <Switch
                    id="heatmap-toggle"
                    checked={showHeatmap}
                    onCheckedChange={setShowHeatmap}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="text-xs md:text-sm font-medium mb-1.5 block">{t("filterByCategory")}</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allCategories")}</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs md:text-sm font-medium mb-1.5 block">{t("filterBySeverity")}</label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allSeverities")}</SelectItem>
                      {severities.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <Badge variant="destructive" className="w-3 h-3 p-0" /> <span>{t("critical")}</span>
                <Badge variant="default" className="w-3 h-3 p-0 ml-3" /> <span>{t("moderate")}</span>
                <Badge variant="secondary" className="w-3 h-3 p-0 ml-3" /> <span>{t("minor")}</span>
                {freshIssueIds.size > 0 && (
                  <span className="ml-3 inline-flex items-center gap-1 text-primary font-semibold animate-pulse">
                    <Zap className="w-3 h-3" />
                    {freshIssueIds.size} new
                  </span>
                )}
                <span className="ml-auto">{filteredIssues.length} {filteredIssues.length === 1 ? t("issue") : t("issues")}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <Card className="overflow-hidden rounded-2xl">
                <MapClusterView
                  issues={filteredIssues}
                  onSelectIssue={setSelectedIssue}
                  showHeatmap={showHeatmap}
                  highlightIssueId={highlightIssueId}
                  freshIssueIds={freshIssueIds}
                  routeGeometry={routeGeom}
                />
              </Card>
              {routeMeta && (
                <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                  <span><Navigation2 className="w-4 h-4 inline mr-1.5 text-primary" />{routeMeta.distance} · ~{routeMeta.duration}</span>
                  <Button size="sm" variant="ghost" onClick={clearRoute}><X className="w-4 h-4 mr-1" />Clear route</Button>
                </div>
              )}
            </div>

            <div>
              {selectedIssue ? (
                <Card className="rounded-2xl">
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="flex items-center justify-between text-base md:text-lg">
                      {t("issueDetails")}
                      <Badge variant={getSeverityBadge(selectedIssue.severity) as any}>{t(selectedIssue.severity)}</Badge>
                    </CardTitle>
                    <CardDescription>{selectedIssue.issue_category}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 md:p-6 pt-0">
                    {selectedIssue.image_url && (
                      <StorageImage path={selectedIssue.image_url} alt="Issue" className="w-full h-36 md:h-48 object-cover rounded-xl" loading="lazy" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Description</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{selectedIssue.short_description}</p>
                    </div>
                    {selectedIssue.location_data?.address && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Location</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">{selectedIssue.location_data.address}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t("status")}</h4>
                      <Badge>{selectedIssue.status}</Badge>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t("reportedOn")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{new Date(selectedIssue.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button onClick={() => showRouteToIssue(selectedIssue)} className="w-full rounded-xl h-10 md:h-11">
                      <Navigation2 className="w-4 h-4 mr-2" /> {t("showRouteToIssue")}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl">
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="text-base md:text-lg">{t("issueDetails")}</CardTitle>
                    <CardDescription>{t("clickMarkerDetails")}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6">
                    <div className="text-center py-8 md:py-12 text-muted-foreground">
                      <MapPin className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">{t("selectOnMap")}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Map;
