import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { downloadCSV, downloadPDF } from "@/lib/exportUtils";
import ReportDetailView from "@/components/ReportDetailView";
import {
  Clock, CalendarCheck, Loader2, Plus, Trash2, Play, Pause,
  FileText, Download, FileDown, RefreshCw, Eye
} from "lucide-react";

interface ScheduledConfig {
  id: string;
  admin_id: string;
  frequency: string;
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface GeneratedReport {
  id: string;
  title: string;
  summary: string;
  report_data: any;
  period_start: string;
  period_end: string;
  created_at: string;
}

const AdminScheduledReports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ScheduledConfig[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [configRes, reportRes] = await Promise.all([
      supabase.from("scheduled_report_configs").select("*").order("created_at", { ascending: false }),
      supabase.from("generated_reports").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setConfigs(configRes.data || []);
    setReports(reportRes.data || []);
    setLoading(false);
  };

  const createConfig = async (frequency: string) => {
    if (!user) return;
    setCreating(true);

    const intervalMap: Record<string, string> = {
      daily: "1 day",
      weekly: "7 days",
      monthly: "30 days",
    };

    const { error } = await supabase.from("scheduled_report_configs").insert({
      admin_id: user.id,
      frequency,
      next_run_at: new Date(Date.now() + (frequency === "daily" ? 86400000 : frequency === "weekly" ? 604800000 : 2592000000)).toISOString(),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Created", description: `${frequency} report schedule activated.` });
      fetchData();
    }
    setCreating(false);
  };

  const toggleConfig = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("scheduled_report_configs")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentActive } : c));
    }
  };

  const deleteConfig = async (id: string) => {
    const { error } = await supabase.from("scheduled_report_configs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setConfigs(prev => prev.filter(c => c.id !== id));
      toast({ title: "Deleted", description: "Schedule removed." });
    }
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-report");
      if (error) throw error;
      toast({ title: "Report Generated", description: `Processed ${data?.processed || 0} schedule(s).` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate report", variant: "destructive" });
    }
    setGenerating(false);
  };

  const exportReport = (report: GeneratedReport, format: "csv" | "pdf") => {
    const data = report.report_data;
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Reports", String(data.totalReports || 0)],
      ["Resolution Rate", `${data.resolutionRate || 0}%`],
      ["Period", `${new Date(report.period_start).toLocaleDateString("en-IN")} – ${new Date(report.period_end).toLocaleDateString("en-IN")}`],
      ...Object.entries(data.statusCounts || {}).map(([k, v]) => [`Status: ${k}`, String(v)]),
      ...Object.entries(data.categoryCounts || {}).map(([k, v]) => [`Category: ${k}`, String(v)]),
      ...Object.entries(data.severityCounts || {}).map(([k, v]) => [`Severity: ${k}`, String(v)]),
    ];

    if (format === "csv") {
      downloadCSV(`report-${report.id.slice(0, 8)}.csv`, headers, rows);
    } else {
      downloadPDF(`report-${report.id.slice(0, 8)}.pdf`, report.title, headers, rows);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedReport) {
    return <ReportDetailView report={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Schedule Management */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Report Schedules</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateNow} disabled={generating || configs.length === 0}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Generate Now
              </Button>
              <Select onValueChange={createConfig} disabled={creating}>
                <SelectTrigger className="w-[160px] h-9">
                  <Plus className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Add Schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>Configure automatic analytics report generation. Reports are delivered as in-app notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No schedules configured. Add one to start receiving automated reports.</p>
            </div>
          ) : (
            configs.map(config => (
              <div key={config.id} className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                <div className="flex items-center gap-3">
                  <Switch checked={config.is_active} onCheckedChange={() => toggleConfig(config.id, config.is_active)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{config.frequency}</span>
                      <Badge variant={config.is_active ? "default" : "secondary"} className="text-[10px]">
                        {config.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {config.last_sent_at
                        ? `Last: ${new Date(config.last_sent_at).toLocaleDateString("en-IN")}`
                        : "Never generated"}
                      {config.next_run_at && ` · Next: ${new Date(config.next_run_at).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteConfig(config.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Generated Reports */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Generated Reports</CardTitle>
          </div>
          <CardDescription>Previously generated analytics summaries — click to view detailed charts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No reports generated yet. Create a schedule or click "Generate Now".</p>
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="p-4 rounded-lg border bg-background/50 space-y-2 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setSelectedReport(report)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">{report.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      Generated {new Date(report.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }} title="View Details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); exportReport(report, "csv"); }} title="Download CSV">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); exportReport(report, "pdf"); }} title="Download PDF">
                      <FileDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{report.summary}</p>
                {report.report_data && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {report.report_data.totalReports || 0} reports
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {report.report_data.resolutionRate || 0}% resolved
                    </Badge>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminScheduledReports;
