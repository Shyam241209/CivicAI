import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, Activity, CheckCircle2, AlertTriangle, Building2, Sparkles, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: Activity },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: XCircle },
};

const AdminDashboardHome = () => {
  const [counts, setCounts] = useState({ total: 0, critical: 0, pending: 0, in_progress: 0, resolved: 0 });
  const [attention, setAttention] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, role, loading: authLoading } = useAuth();

  const fetchDashboard = useCallback(async () => {
    if (!user || role !== "admin") {
      setLoading(false);
      setError("Admin session unavailable.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("civic_reports")
      .select("id, status, severity, priority_level, short_description, issue_category, suggested_department, assigned_department_id, auto_assign_confidence, created_at, location_data")
      .order("created_at", { ascending: false });

    if (queryError) {
      if (import.meta.env.DEV) console.error("Unable to load admin dashboard data", queryError);
      setError("Unable to load admin dashboard data.");
      setLoading(false);
      return;
    }

    try {
      const all = data || [];
      setCounts({
        total: all.length,
        critical: all.filter((r) => r.severity === "critical").length,
        pending: all.filter((r) => ["pending", "submitted", "verified", "assigned"].includes(r.status || "pending")).length,
        in_progress: all.filter((r) => r.status === "in_progress").length,
        resolved: all.filter((r) => r.status === "resolved").length,
      });
      const priority = (r: any) => r.severity === "critical" ? 0 : r.priority_level === "high" || r.severity === "high" ? 1 : !r.assigned_department_id ? 2 : 3;
      setAttention(all.filter((r) => r.status !== "resolved" && r.status !== "rejected").sort((a, b) => priority(a) - priority(b)).slice(0, 8));
    } catch (processingError) {
      if (import.meta.env.DEV) console.error("Unable to process admin dashboard data", processingError);
      setError("Unable to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useEffect(() => {
    if (!authLoading) void fetchDashboard();
  }, [authLoading, fetchDashboard]);

  const stats = [
    { label: "Total Reports", value: counts.total, icon: FileText, color: "text-primary" },
    { label: "Critical", value: counts.critical, icon: AlertTriangle, color: "text-destructive" },
    { label: "Pending", value: counts.pending, icon: Clock, color: "text-yellow-600" },
    { label: "In Progress", value: counts.in_progress, icon: Activity, color: "text-blue-600" },
    { label: "Resolved", value: counts.resolved, icon: CheckCircle2, color: "text-green-600" },
  ];

  const overview = [
    { label: "Pending vs Resolved", value: `${counts.pending} / ${counts.resolved}`, detail: "Current workload balance" },
    { label: "Critical Reports", value: counts.critical, detail: "Requires immediate attention" },
    { label: "Open Queue", value: counts.pending + counts.in_progress, detail: "Pending and active reports" },
  ];

  const workflow = ["SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

  return (
    <AdminLayout title="Dashboard">
      {error ? (
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <XCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium text-slate-600">{error}</p>
            <Button onClick={() => void fetchDashboard()}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
      <>
      <section className="mb-6 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-3 border-primary/15 bg-primary/5 text-primary">INTERNAL ADMIN CONTROL CENTER</Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">CivicAI Admin</h2>
          <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">Tamil Nadu Civic Administration</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Monitor and manage civic reports across Tamil Nadu.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live operations</p>
            <p className="text-sm font-semibold text-slate-900">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold tracking-tight text-slate-950">{s.value}</p>}
              <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="rounded-xl">
          <CardHeader className="p-5"><CardTitle className="text-lg text-slate-900">Tamil Nadu Civic Overview</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {overview.map((item) => (
              <div key={item.label} className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "—" : item.value}</p>
                <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="p-5"><CardTitle className="text-lg text-slate-900">Status Workflow</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              {workflow.map((step, index) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-full border bg-muted/30 px-2.5 py-1">{step}</span>
                  {index < workflow.length - 1 && <span aria-hidden="true">→</span>}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-destructive">REJECTED is a separate validated outcome.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["View Reports", "/admin/reports"],
          ["View Map", "/admin/map"],
          ["Manage Departments", "/admin/departments"],
          ["Manage Staff", "/admin/staff"],
          ["View Analytics", "/admin/analytics"],
        ].map(([label, to]) => <Button key={to} asChild variant="outline" className="min-h-11 rounded-xl"><Link to={to}>{label}</Link></Button>)}
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between p-5">
          <CardTitle className="text-lg text-slate-900">Reports Requiring Attention</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/reports">View All</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && attention.length === 0 && <p className="text-sm text-slate-500">No reports require attention.</p>}
          {attention.map((r) => {
            const meta = statusMeta[r.status || "pending"] || statusMeta.pending;
            const loc = (r.location_data || {}) as Record<string, unknown>;
            const address = typeof loc.address === "string" ? loc.address : "Tamil Nadu location pending";
            return (
              <Link key={r.id} to={`/admin/complaints/${r.id}`} className="block p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">CR-{r.id.slice(0, 8).toUpperCase()}</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{r.short_description || r.issue_category || "Civic report"}</p>
                  </div>
                  <Badge className={meta.color} variant="outline">{meta.label}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{r.issue_category || "Unclassified"}</span>
                  <span className="font-medium uppercase">{r.priority_level || r.severity || "priority pending"}</span>
                  <span>{address}</span>
                  {r.assigned_department_id || r.suggested_department ? <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{r.suggested_department || "Assigned department"}</span> : <span className="inline-flex items-center gap-1 text-warning"><Building2 className="h-3 w-3" />Needs assignment</span>}
                  {typeof r.auto_assign_confidence === "number" && <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />AI {Math.round(r.auto_assign_confidence * 100)}%</span>}
                  <span>{new Date(r.created_at).toLocaleString("en-IN")}</span>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
      </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboardHome;