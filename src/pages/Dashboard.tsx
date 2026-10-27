import { useEffect, useMemo, useState, useCallback, lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, TrendingUp, CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/AppLayout";
import { CitizenReportCard } from "@/components/CitizenReportCard";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useTranslation } from "@/hooks/use-translation";

// MapLibre (~1MB) must not be part of the dashboard's first paint.
const CitizenMapPreview = lazy(() =>
  import("@/components/CitizenMapPreview").then((m) => ({ default: m.CitizenMapPreview }))
);

// Only the columns the dashboard actually renders.
const REPORT_COLUMNS =
  "id,image_url,user_description,issue_category,severity,priority_level,short_description,suggested_department,status,created_at,estimated_resolution_time,assigned_department_id,auto_assign_confidence,auto_assign_match_method,auto_assign_pending_confirmation,location_data";
const PAGE_SIZE = 30;

const normalizeLocationData = (value: unknown): Report["location_data"] => {
  if (!value || typeof value !== "object") return null;

  const loc = value as Record<string, unknown>;
  const lat = loc.lat;
  const lng = loc.lng;

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    lat,
    lng,
    ...(typeof loc.address === "string" && loc.address.trim() ? { address: loc.address.trim() } : {}),
  };
};

interface Report {
  id: string;
  image_url: string | null;
  user_description: string;
  issue_category: string;
  severity: string;
  priority_level: string;
  short_description: string;
  suggested_department: string;
  status: string;
  created_at: string;
  estimated_resolution_time: string | null;
  assigned_department_id?: string | null;
  assigned_department_name?: string | null;
  auto_assign_confidence?: number | null;
  auto_assign_match_method?: string | null;
  auto_assign_pending_confirmation?: boolean | null;
  location_data: {
    lat?: number;
    lng?: number;
    address?: string;
  } | null;
}

const Dashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const hasExistingReportsRef = useRef(false);

  const fetchReports = useCallback(async (showLoading = true, limit = PAGE_SIZE) => {
    const shouldShowInitialLoading = showLoading && !hasExistingReportsRef.current;

    try {
      if (shouldShowInitialLoading) setIsLoading(true);
      setLoadError(false);
      let query = supabase
        .from("civic_reports")
        .select(REPORT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (user) query = query.eq("user_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      const rows = ((data || []) as Report[]).map((r) => ({
        ...r,
        location_data: normalizeLocationData(r.location_data),
      }));
      setHasMore(rows.length === limit);
      const deptIds = Array.from(new Set(rows.map(r => r.assigned_department_id).filter(Boolean)));
      const deptMap: Record<string, string> = {};
      if (deptIds.length) {
        const { data: deps } = await supabase.from("departments").select("id,name").in("id", deptIds);
        const dependencyRows = (deps || []) as { id: string; name: string }[];
        dependencyRows.forEach(d => { deptMap[d.id] = d.name; });
      }
      const nextReports = rows.map(r => ({
        ...r,
        assigned_department_name: r.assigned_department_id ? deptMap[r.assigned_department_id] || null : null,
      }));
      hasExistingReportsRef.current = nextReports.length > 0;
      setReports(nextReports);
    } catch (error) {
      setLoadError(true);
      toast({
        title: "Unable to load your reports",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      if (shouldShowInitialLoading || !hasExistingReportsRef.current) {
        setIsLoading(false);
      }
      setLoadingMore(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      hasExistingReportsRef.current = false;
      setReports([]);
      setHasMore(false);
      setLoadError(false);
      setIsLoading(false);
      return;
    }

    fetchReports(true);

    const channel = supabase
      .channel('citizen-reports-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'civic_reports',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const next = payload.new as Report;
            setReports(prev => [{ ...next, location_data: normalizeLocationData(next.location_data) }, ...prev]);
            hasExistingReportsRef.current = true;
            toast({ title: t("newReport"), description: t("success") });
          } else if (payload.eventType === 'UPDATE') {
            const next = payload.new as Report;
            setReports(prev => prev.map(r => r.id === next.id ? { ...next, location_data: normalizeLocationData(next.location_data) } : r));
            hasExistingReportsRef.current = true;
            toast({ title: t("status"), description: `${(next as Report).status?.replace('_', ' ')}` });
          } else if (payload.eventType === 'DELETE') {
            setReports(prev => prev.filter(r => r.id !== payload.old.id));
            hasExistingReportsRef.current = true;
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchReports, loading, t, toast, user]);

  const handlePullRefresh = async () => {
    await fetchReports(false, Math.max(PAGE_SIZE, reports.length));
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchReports(false, reports.length + PAGE_SIZE);
  };

  const filteredReports = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return reports.filter(report => {
      const matchesSearch =
        report.issue_category?.toLowerCase().includes(q) ||
        report.short_description?.toLowerCase().includes(q);
      const matchesFilter = filterStatus === "all" || report.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [reports, searchTerm, filterStatus]);

  const stats = useMemo(() => ({
    total: reports.length,
    open: reports.filter(r => r.status !== "resolved").length,
    inProgress: reports.filter(r => r.status === "in_progress").length,
    resolved: reports.filter(r => r.status === "resolved").length,
  }), [reports]);

  const handleReportSelect = (report: Report) => {
    setSelectedReportId(report.id === selectedReportId ? undefined : report.id);
  };

  if (isLoading && reports.length === 0) {
    return (
      <AppLayout overlay="medium">
        <div className="py-6 md:py-8 px-4">
          <div className="w-full mx-auto space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout overlay="medium">
      <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="py-6 md:py-8 px-4">
        <div className="w-full mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="text-center mb-4 md:mb-6">
              <div className="inline-block bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
                {t("citizenDashboard")}
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2">{t("myReports")}</h1>
              <p className="text-sm md:text-lg text-muted-foreground">
                {t("trackReportsDesc")}
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <Card className="border-2 rounded-2xl">
                <CardContent className="p-3 md:pt-4 md:pb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-bold">{stats.total}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{t("total")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 rounded-2xl border-warning/20 bg-warning/5">
                <CardContent className="p-3 md:pt-4 md:pb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-warning/10 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-bold text-warning">{stats.open}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{t("open")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 rounded-2xl border-primary/20 bg-primary/5">
                <CardContent className="p-3 md:pt-4 md:pb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-bold text-primary">{stats.inProgress}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{t("inProgress")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 rounded-2xl border-success/20 bg-success/5">
                <CardContent className="p-3 md:pt-4 md:pb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-success/10 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-bold text-success">{stats.resolved}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{t("resolved")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
            {/* Reports List */}
            <div className="lg:col-span-2 space-y-3 md:space-y-4">
              {/* Search and Filter */}
              <Card className="border-2 rounded-2xl">
                <CardContent className="py-3 md:py-4 px-3 md:px-6">
                  <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t("searchReports")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 md:h-11 rounded-xl"
                      />
                    </div>
                    <div className="flex gap-1.5 md:gap-2 flex-wrap">
                      {[
                        { key: "all", label: t("all") },
                        { key: "pending", label: t("pending") },
                        { key: "in_progress", label: t("inProgress") },
                        { key: "resolved", label: t("resolved") },
                      ].map((status) => (
                        <Button
                          key={status.key}
                          size="sm"
                          variant={filterStatus === status.key ? "default" : "outline"}
                          onClick={() => setFilterStatus(status.key)}
                          className="text-xs md:text-sm rounded-lg h-8 md:h-9 px-2.5 md:px-3"
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {loadError && reports.length === 0 ? (
                <Card className="border-2 rounded-2xl">
                  <CardContent className="py-12 text-center space-y-4">
                    <p className="text-base text-muted-foreground">
                      Unable to load your reports right now.
                    </p>
                    <Button className="rounded-xl" onClick={() => fetchReports()}>
                      Try again
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {loadError && reports.length > 0 && (
                    <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      Unable to refresh reports right now. Showing the last saved data.
                    </div>
                  )}
                  {filteredReports.length === 0 ? (
                    <Card className="border-2 rounded-2xl">
                      <CardContent className="py-12 md:py-16 text-center">
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg md:text-xl text-muted-foreground mb-2">
                          {searchTerm || filterStatus !== "all" ? t("noMatchFilter") : t("noReportsYet")}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground mb-6">
                          {searchTerm || filterStatus !== "all" ? t("tryAdjusting") : t("beFirstReport")}
                        </p>
                        <Button asChild className="rounded-xl">
                          <Link to="/report">
                            <Plus className="w-4 h-4 mr-2" />
                            {t("submitFirstReport")}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {filteredReports.map((report) => (
                        <CitizenReportCard
                          key={report.id}
                          report={report}
                          isSelected={report.id === selectedReportId}
                          onSelect={handleReportSelect}
                        />
                      ))}
                      {hasMore && (
                        <Button
                          variant="outline"
                          className="w-full rounded-xl h-11"
                          onClick={loadMore}
                          disabled={loadingMore}
                        >
                          {loadingMore ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Load more reports
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Map Preview & Actions */}
            <div className="space-y-3 md:space-y-4">
              <div className="hidden lg:block">
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                  <CitizenMapPreview
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onMarkerClick={(id) => setSelectedReportId(id)}
                  />
                </Suspense>
              </div>

              <Card className="border-2 rounded-2xl">
                <CardContent className="py-3 md:py-4">
                  <Button asChild className="w-full rounded-xl h-11 md:h-12" size="lg">
                    <Link to="/report">
                      <Plus className="w-5 h-5 mr-2" />
                      {t("reportNewIssue")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-success/20 bg-success/5 rounded-2xl">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-3 h-3 bg-success rounded-full" />
                      <div className="absolute inset-0 w-3 h-3 bg-success rounded-full animate-ping" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-success">{t("liveUpdatesActive")}</p>
                      <p className="text-xs text-muted-foreground">{t("liveUpdatesDesc")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      </PullToRefresh>
    </AppLayout>
  );
};

export default Dashboard;
