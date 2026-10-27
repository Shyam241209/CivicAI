import { StorageImage } from "@/components/StorageImage";
import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Search, Filter, LogOut, MapPin, Calendar, Navigation2, Map, Users, Activity, Share2, Copy, Check, Twitter, Facebook, Settings, BarChart3, Download, FileDown, CalendarCheck, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { GovernmentBackground } from "@/components/GovernmentBackground";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { downloadCSV, downloadPDF } from "@/lib/exportUtils";

// Heavy panels (MapLibre ~1MB, Recharts ~400KB) load only when their tab opens.
const AdminMapView = lazy(() =>
  import("@/components/AdminMapView").then((m) => ({ default: m.AdminMapView }))
);
const AdminUserManagement = lazy(() => import("@/components/AdminUserManagement"));
const AdminActivityLog = lazy(() => import("@/components/AdminActivityLog"));
const AdminSettings = lazy(() => import("@/components/AdminSettings"));
const AdminAnalytics = lazy(() => import("@/components/AdminAnalytics"));
const AdminScheduledReports = lazy(() => import("@/components/AdminScheduledReports"));
const AdminDepartmentsPanel = lazy(() => import("@/components/AdminDepartmentsPanel"));

const PanelFallback = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-56 rounded-xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
  </div>
);

type ReportLocationData = {
  lat?: number;
  lng?: number;
  address?: string;
} | null;

interface Report {
  id: string;
  user_id: string;
  user_description: string;
  issue_category: string;
  severity: string;
  status: string;
  location_data: ReportLocationData;
  image_url: string;
  created_at: string;
  ai_confidence_score: number;
}

const AdminDashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const location = useLocation();
  const routeTab =
    ({
      "/admin/map": "map",
      "/admin/users": "users",
      "/admin/analytics": "analytics",
      "/admin/settings": "settings",
    } as Record<string, string>)[location.pathname] || "list";
  const [activeTab, setActiveTab] = useState(routeTab);

  useEffect(() => {
    setActiveTab(routeTab);
  }, [routeTab]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();

  const fetchReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("civic_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setReports(data || []);
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : String(error || "An unexpected error occurred.");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleStatusUpdate = async (reportId: string, newStatus: string) => {
    try {
      const report = reports.find(r => r.id === reportId);
      const oldStatus = report?.status;

      const workflowStatus: Record<string, string> = {
        pending: "VERIFIED",
        in_progress: "IN_PROGRESS",
        resolved: "RESOLVED",
      };
      const { error } = await supabase.rpc("transition_civic_report_status", {
        p_report_id: reportId,
        p_status: workflowStatus[newStatus] || newStatus.toUpperCase(),
      });

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from("admin_activity_logs").insert({
          admin_id: user.id,
          action: "status_change",
          target_type: "report",
          target_id: reportId,
          details: `Changed report status from "${oldStatus}" to "${newStatus}"`,
        });
      }

      toast({
        title: "Success",
        description: "Report status updated successfully",
      });

      fetchReports();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.user_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.issue_category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || report.status === filterStatus;
    const matchesSeverity = filterSeverity === "all" || report.severity === filterSeverity;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    inProgress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GovernmentBackground overlay="medium">
      <div className="w-full mx-auto px-4 md:px-6 py-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
              {t("adminPortalTag")}
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{t("adminDashboardTitle")}</h1>
            <p className="text-muted-foreground">{t("manageTrackReports")}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="bg-background/80 backdrop-blur-sm">
            <LogOut className="w-4 h-4 mr-2" />
            {t("logout")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 bg-card/95 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalReports")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-2 bg-card/95 backdrop-blur-sm border-warning/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("pending")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="border-2 bg-card/95 backdrop-blur-sm border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("inProgress")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card className="border-2 bg-card/95 backdrop-blur-sm border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("resolved")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.resolved}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/95 backdrop-blur-sm border-2">
            <TabsTrigger value="list" className="gap-2">
              <Filter className="w-4 h-4" />
              {t("listView")}
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <Map className="w-4 h-4" />
              {t("mapViewTab")}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              {t("manageAdmins")}
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="w-4 h-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="w-4 h-4" />
              {t("activityLog")}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <CalendarCheck className="w-4 h-4" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <Card className="border-2 bg-card/95 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input placeholder={t("searchByCategoryDesc")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder={t("status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allStatus")}</SelectItem>
                      <SelectItem value="pending">{t("pending")}</SelectItem>
                      <SelectItem value="in_progress">{t("inProgress")}</SelectItem>
                      <SelectItem value="resolved">{t("resolved")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder={t("severity")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allSeverity")}</SelectItem>
                      <SelectItem value="high">{t("high")}</SelectItem>
                      <SelectItem value="medium">{t("medium")}</SelectItem>
                      <SelectItem value="low">{t("low")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" title="Export reports">
                        <Download className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        const headers = ["ID", "Category", "Description", "Severity", "Status", "Date", "Location"];
                        const rows = filteredReports.map(r => {
                          const loc = r.location_data as any;
                          return [
                            r.id.slice(0, 8),
                            r.issue_category || "",
                            r.user_description || "",
                            r.severity || "",
                            r.status || "",
                            new Date(r.created_at).toLocaleDateString("en-IN"),
                            loc?.address || (loc?.lat ? `${loc.lat}, ${loc.lng}` : ""),
                          ];
                        });
                        downloadCSV(`civicai-reports-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
                        toast({ title: "Exported", description: `${rows.length} reports exported as CSV` });
                      }}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const headers = ["ID", "Category", "Description", "Severity", "Status", "Date"];
                        const rows = filteredReports.map(r => [
                          r.id.slice(0, 8),
                          r.issue_category || "",
                          (r.user_description || "").slice(0, 80),
                          r.severity || "",
                          r.status || "",
                          new Date(r.created_at).toLocaleDateString("en-IN"),
                        ]);
                        downloadPDF(`civicai-reports-${new Date().toISOString().split("T")[0]}.pdf`, "CivicAI — Reports Export", headers, rows);
                      }}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <Card className="border-2 bg-card/95 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">{t("noReportsFound")}</p>
                  </CardContent>
                </Card>
              ) : (
                filteredReports.map((report) => (
                  <Card key={report.id} className="overflow-hidden border-2 bg-card/95 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        {report.image_url && (
                          <div className="w-full md:w-48 h-48 flex-shrink-0">
                            <StorageImage path={report.image_url} alt="Report" className="w-full h-full object-cover rounded-lg" />
                          </div>
                        )}
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getSeverityColor(report.severity)}>{report.severity?.toUpperCase()}</Badge>
                            <Badge variant="outline">{report.issue_category}</Badge>
                          </div>
                          <p className="text-foreground">{report.user_description}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(report.created_at).toLocaleDateString()}
                            </div>
                            {report.location_data && typeof report.location_data === 'object' && 'lat' in report.location_data && (
                              <button
                                onClick={() => {
                                  const loc = report.location_data;
                                  const query = loc?.address ? encodeURIComponent(loc.address) : `${loc?.lat},${loc?.lng}`;
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
                                }}
                                className="flex items-center gap-1 text-primary hover:underline cursor-pointer transition-colors"
                              >
                                <MapPin className="w-4 h-4" />
                                {t("locationAvailable")}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2 items-center">
                            <Select value={report.status} onValueChange={(value) => handleStatusUpdate(report.id, value)}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">{t("pending")}</SelectItem>
                                <SelectItem value="in_progress">{t("inProgress")}</SelectItem>
                                <SelectItem value="resolved">{t("resolved")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border">
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                  const loc = report.location_data as any;
                                  const locText = loc?.address || "";
                                  const text = `Civic Issue: ${report.issue_category} — ${report.user_description}${locText ? ` at ${locText}` : ""}. Status: ${report.status}`;
                                  const url = `${window.location.origin}/report/${report.id}`;
                                  navigator.clipboard.writeText(`${text}\n${url}`);
                                  toast({ title: t("copiedReport"), description: t("reportDetailsCopied") });
                                }}>
                                  <Copy className="w-4 h-4" /> {t("copyClipboard")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                  const url = `${window.location.origin}/report/${report.id}`;
                                  window.open(`https://wa.me/?text=${encodeURIComponent(`${report.issue_category}: ${report.user_description}\n${url}`)}`, "_blank");
                                }}>
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.4 0-4.636-.817-6.407-2.19l-.147-.117-3.054 1.024 1.024-3.054-.117-.147A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                                  WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                  const url = `${window.location.origin}/report/${report.id}`;
                                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${report.issue_category}: ${report.user_description}`)}&url=${encodeURIComponent(url)}`, "_blank");
                                }}>
                                  <Twitter className="w-4 h-4" /> Twitter / X
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                  const url = `${window.location.origin}/report/${report.id}`;
                                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
                                }}>
                                  <Facebook className="w-4 h-4" /> Facebook
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="map">
            <Suspense fallback={<PanelFallback />}>
              <AdminMapView reports={filteredReports} onStatusUpdate={handleStatusUpdate} onRefresh={fetchReports} />
            </Suspense>
          </TabsContent>

          <TabsContent value="users">
            <Suspense fallback={<PanelFallback />}>
              <AdminUserManagement />
            </Suspense>
          </TabsContent>

          <TabsContent value="departments">
            <Suspense fallback={<PanelFallback />}>
              <AdminDepartmentsPanel />
            </Suspense>
          </TabsContent>

          <TabsContent value="activity">
            <Suspense fallback={<PanelFallback />}>
              <AdminActivityLog />
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics">
            <Suspense fallback={<PanelFallback />}>
              <AdminAnalytics />
            </Suspense>
          </TabsContent>

          <TabsContent value="scheduled">
            <Suspense fallback={<PanelFallback />}>
              <AdminScheduledReports />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings">
            <Suspense fallback={<PanelFallback />}>
              <AdminSettings />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </GovernmentBackground>
  );
};

export default AdminDashboard;