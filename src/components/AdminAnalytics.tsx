import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Clock, PieChart, BarChart3, Calendar, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, downloadPDF } from "@/lib/exportUtils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Report {
  id: string;
  issue_category: string | null;
  severity: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

const COLORS = [
  "hsl(217, 91%, 60%)",  // primary blue
  "hsl(142, 76%, 36%)",  // accent green
  "hsl(38, 92%, 50%)",   // warning orange
  "hsl(0, 84%, 60%)",    // destructive red
  "hsl(262, 80%, 50%)",  // purple
  "hsl(190, 80%, 45%)",  // cyan
  "hsl(330, 80%, 50%)",  // pink
  "hsl(50, 90%, 50%)",   // gold
];

const AdminAnalytics = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30");

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("civic_reports")
        .select("id, issue_category, severity, status, created_at, updated_at")
        .order("created_at", { ascending: true });
      setReports(data || []);
      setLoading(false);
    };
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(timeRange));
    return reports.filter(r => new Date(r.created_at) >= cutoff);
  }, [reports, timeRange]);

  // Report trends over time (daily)
  const trendData = useMemo(() => {
    const days = parseInt(timeRange);
    const map = new Map<string, { date: string; total: number; resolved: number; pending: number; in_progress: number }>();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      map.set(key, { date: key, total: 0, resolved: 0, pending: 0, in_progress: 0 });
    }

    filteredReports.forEach(r => {
      const key = r.created_at.split("T")[0];
      const entry = map.get(key);
      if (entry) {
        entry.total++;
        if (r.status === "resolved") entry.resolved++;
        else if (r.status === "in_progress") entry.in_progress++;
        else entry.pending++;
      }
    });

    return Array.from(map.values()).map(d => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    }));
  }, [filteredReports, timeRange]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredReports.forEach(r => {
      const cat = r.issue_category || "Uncategorized";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReports]);

  // Severity breakdown
  const severityData = useMemo(() => {
    const map = new Map<string, number>();
    filteredReports.forEach(r => {
      const sev = r.severity || "unknown";
      map.set(sev, (map.get(sev) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [filteredReports]);

  // Resolution time (avg days between created_at and updated_at for resolved)
  const resolutionStats = useMemo(() => {
    const resolved = filteredReports.filter(r => r.status === "resolved");
    if (resolved.length === 0) return { avg: 0, fastest: 0, slowest: 0, count: 0 };

    const times = resolved.map(r => {
      const created = new Date(r.created_at).getTime();
      const updated = new Date(r.updated_at).getTime();
      return Math.max((updated - created) / (1000 * 60 * 60 * 24), 0);
    });

    return {
      avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
      fastest: +Math.min(...times).toFixed(1),
      slowest: +Math.max(...times).toFixed(1),
      count: resolved.length,
    };
  }, [filteredReports]);

  // Status distribution
  const statusData = useMemo(() => {
    const pending = filteredReports.filter(r => r.status === "pending").length;
    const inProgress = filteredReports.filter(r => r.status === "in_progress").length;
    const resolved = filteredReports.filter(r => r.status === "resolved").length;
    return [
      { name: "Pending", value: pending },
      { name: "In Progress", value: inProgress },
      { name: "Resolved", value: resolved },
    ].filter(d => d.value > 0);
  }, [filteredReports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time filter & export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Analytics Overview</h3>
          <Badge variant="secondary">{filteredReports.length} reports</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Export analytics">
                <Download className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const headers = ["Date", "Total", "Pending", "In Progress", "Resolved"];
                const rows = trendData.map(d => [d.label, String(d.total), String(d.pending), String(d.in_progress), String(d.resolved)]);
                downloadCSV(`civicai-analytics-${timeRange}d-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
              }}>
                <FileDown className="w-4 h-4 mr-2" />
                Trends CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const headers = ["Category", "Count"];
                const rows = categoryData.map(d => [d.name, String(d.value)]);
                downloadCSV(`civicai-categories-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
              }}>
                <FileDown className="w-4 h-4 mr-2" />
                Categories CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const headers = ["Metric", "Value"];
                const rows = [
                  ["Total Reports", String(filteredReports.length)],
                  ["Avg Resolution (days)", String(resolutionStats.avg)],
                  ["Fastest Resolution (days)", String(resolutionStats.fastest)],
                  ["Slowest Resolution (days)", String(resolutionStats.slowest)],
                  ["Resolved Count", String(resolutionStats.count)],
                  ["Resolution Rate", `${filteredReports.length > 0 ? Math.round((resolutionStats.count / filteredReports.length) * 100) : 0}%`],
                  ...categoryData.map(c => [`Category: ${c.name}`, String(c.value)]),
                  ...severityData.map(s => [`Severity: ${s.name}`, String(s.value)]),
                ];
                downloadPDF(`civicai-analytics-${new Date().toISOString().split("T")[0]}.pdf`, `CivicAI Analytics — Last ${timeRange} Days`, headers, rows);
              }}>
                <FileDown className="w-4 h-4 mr-2" />
                Full Report PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{filteredReports.length}</p>
            <p className="text-xs text-muted-foreground">Total Reports</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-warning mb-1" />
            <p className="text-2xl font-bold">{resolutionStats.avg}<span className="text-sm font-normal">d</span></p>
            <p className="text-xs text-muted-foreground">Avg Resolution</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <PieChart className="w-5 h-5 mx-auto text-accent mb-1" />
            <p className="text-2xl font-bold">
              {filteredReports.length > 0
                ? Math.round((filteredReports.filter(r => r.status === "resolved").length / filteredReports.length) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Resolution Rate</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{resolutionStats.fastest}<span className="text-sm font-normal">d</span></p>
            <p className="text-xs text-muted-foreground">Fastest Resolution</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Trends */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Report Trends</CardTitle>
          <CardDescription>Daily report submissions over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="pending" stackId="1" fill="hsl(38, 92%, 50%)" stroke="hsl(38, 92%, 50%)" fillOpacity={0.6} name="Pending" />
                <Area type="monotone" dataKey="in_progress" stackId="1" fill="hsl(217, 91%, 60%)" stroke="hsl(217, 91%, 60%)" fillOpacity={0.6} name="In Progress" />
                <Area type="monotone" dataKey="resolved" stackId="1" fill="hsl(142, 76%, 36%)" stroke="hsl(142, 76%, 36%)" fillOpacity={0.6} name="Resolved" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
            <CardDescription>Reports by issue type</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" name="Reports" radius={[0, 4, 4, 0]}>
                      {categoryData.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Pie */}
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>Current report statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="hsl(38, 92%, 50%)" />
                      <Cell fill="hsl(217, 91%, 60%)" />
                      <Cell fill="hsl(142, 76%, 36%)" />
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Severity Breakdown</CardTitle>
            <CardDescription>Reports by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Reports" radius={[4, 4, 0, 0]}>
                      {severityData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.name.toLowerCase() === "high" ? "hsl(0, 84%, 60%)" :
                            entry.name.toLowerCase() === "medium" ? "hsl(38, 92%, 50%)" :
                            entry.name.toLowerCase() === "low" ? "hsl(142, 76%, 36%)" :
                            "hsl(215, 16%, 47%)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolution Time Stats */}
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Resolution Time</CardTitle>
            <CardDescription>How quickly reports are being resolved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary">{resolutionStats.avg}</p>
                <p className="text-xs text-muted-foreground">Avg Days</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-accent">{resolutionStats.fastest}</p>
                <p className="text-xs text-muted-foreground">Fastest (days)</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-destructive">{resolutionStats.slowest}</p>
                <p className="text-xs text-muted-foreground">Slowest (days)</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{resolutionStats.count}</p>
                <p className="text-xs text-muted-foreground">Resolved Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
