import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, Bell, Building2, FileText, Map, Settings, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const quickActions = [
  { label: "View Reports", description: "Review and manage incoming civic complaints.", to: "/admin/reports", icon: FileText },
  { label: "Map View", description: "Inspect civic reports geographically across Tamil Nadu.", to: "/admin/map", icon: Map },
  { label: "Manage Departments", description: "Manage departments and automatic complaint routing.", to: "/admin/departments", icon: Building2 },
  { label: "Manage Staff", description: "Review staff and administrator access.", to: "/admin/staff", icon: Users },
  { label: "View Analytics", description: "Open operational trends and insights.", to: "/admin/analytics", icon: BarChart3 },
  { label: "Notifications", description: "Review administrative notifications.", to: "/admin/notifications", icon: Bell },
];

const resources = [
  { label: "Activity Log", to: "/admin/activity", icon: Activity },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Scheduled Reports", to: "/admin/scheduled-reports", icon: FileText },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

interface ActivityItem {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface Overview {
  totalReports: number | null;
  pendingReports: number | null;
  departments: number | null;
  activeItems: number | null;
}

const initialOverview: Overview = {
  totalReports: null,
  pendingReports: null,
  departments: null,
  activeItems: null,
};

const AdminHome = () => {
  const { user, role, loading: authLoading } = useAuth();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [overview, setOverview] = useState<Overview>(initialOverview);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== "admin") {
      setActivityLoading(false);
      setOverviewLoading(false);
      return;
    }

    let active = true;

    const loadHomeData = async () => {
      const [reportsResult, departmentsResult, activityResult] = await Promise.all([
        supabase.from("civic_reports").select("status"),
        supabase.from("departments").select("id"),
        supabase
          .from("admin_activity_logs" as any)
          .select("id, action, details, created_at")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      if (!active) return;

      const reports = (reportsResult.data || []) as { status: string | null }[];
      const totalReports = reportsResult.error ? null : reports.length;
      const pendingReports = reportsResult.error
        ? null
        : reports.filter((report) => !["resolved", "rejected"].includes(report.status || "pending")).length;
      const departments = departmentsResult.error ? null : (departmentsResult.data || []).length;
      const activeItems = reportsResult.error ? null : pendingReports;

      setOverview({ totalReports, pendingReports, departments, activeItems });
      setActivity(activityResult.error ? [] : ((activityResult.data as unknown as ActivityItem[]) || []));
      setActivityLoading(false);
      setOverviewLoading(false);
    };

    void loadHomeData();
    return () => { active = false; };
  }, [authLoading, role, user]);

  const overviewItems = [
    { label: "Total Reports", value: overview.totalReports, icon: FileText, tone: "text-primary" },
    { label: "Pending Reports", value: overview.pendingReports, icon: Activity, tone: "text-warning" },
    { label: "Departments", value: overview.departments, icon: Building2, tone: "text-accent" },
    { label: "Active Items", value: overview.activeItems, icon: Bell, tone: "text-slate-700" },
  ];

  return (
    <AdminLayout title="Home">
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-primary/10 to-transparent sm:block" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3 border-primary/15 bg-primary/5 text-primary">ADMIN CONTROL CENTER</Badge>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Welcome to CivicAI Admin</h2>
                <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">Tamil Nadu Civic Administration</p>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Manage civic reports, departments, staff, field operations, analytics, and administrative activities across Tamil Nadu from one place.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-950">Quick Overview</h3>
          <p className="mt-1 text-sm text-slate-500">A current snapshot of administrative workload and coverage.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {overviewItems.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="rounded-xl bg-white/95">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${tone}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live data</span>
                </div>
                {overviewLoading ? <Skeleton className="h-8 w-14" /> : <p className="text-2xl font-bold tracking-tight text-slate-950">{value ?? "Unavailable"}</p>}
                <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Quick Actions</h3>
            <p className="mt-1 text-sm text-slate-500">Jump directly into the operational areas you manage most.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ label, description, to, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-slate-900">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between p-5">
            <div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Latest administrative actions from the system.</p>
            </div>
            <Link to="/admin/activity" className="text-sm font-medium text-primary hover:underline">Open log</Link>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {activityLoading && <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
            {!activityLoading && activity.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No recent activity recorded.</p>}
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{item.action.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium text-slate-900">{item.details || item.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="p-5">
            <CardTitle className="text-lg">Administrative Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {resources.map(({ label, to, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600 transition hover:bg-primary/5 hover:text-primary">
                <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </AdminLayout>
  );
};

export default AdminHome;
