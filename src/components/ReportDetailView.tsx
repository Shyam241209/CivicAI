import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, Download, FileDown, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/exportUtils";

interface GeneratedReport {
  id: string;
  title: string;
  summary: string;
  report_data: any;
  period_start: string;
  period_end: string;
  created_at: string;
}

interface ReportDetailViewProps {
  report: GeneratedReport;
  onBack: () => void;
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(196, 100%, 47%)",
  "hsl(330, 81%, 60%)",
  "hsl(45, 93%, 47%)",
];

const ReportDetailView = ({ report, onBack }: ReportDetailViewProps) => {
  const data = report.report_data || {};
  const totalReports = data.totalReports || 0;
  const resolutionRate = data.resolutionRate || 0;

  const statusData = Object.entries(data.statusCounts || {}).map(([name, value]) => ({
    name: name.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: value as number,
  }));

  const categoryData = Object.entries(data.categoryCounts || {}).map(([name, value]) => ({
    name: name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: value as number,
  }));

  const severityData = Object.entries(data.severityCounts || {}).map(([name, value]) => ({
    name: name.replace(/\b\w/g, c => c.toUpperCase()),
    value: value as number,
  }));

  const exportReport = (format: "csv" | "pdf") => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Reports", String(totalReports)],
      ["Resolution Rate", `${resolutionRate}%`],
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{report.title}</h2>
            <p className="text-sm text-muted-foreground">
              Generated {new Date(report.created_at).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => exportReport("csv")}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport("pdf")}>
            <FileDown className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-foreground">{totalReports}</p>
            <p className="text-xs text-muted-foreground">Total Reports</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-2xl font-bold text-success">{resolutionRate}%</p>
            <p className="text-xs text-muted-foreground">Resolution Rate</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-2xl font-bold text-warning">{data.statusCounts?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-2xl font-bold text-destructive">{data.severityCounts?.high || 0}</p>
            <p className="text-xs text-muted-foreground">High Severity</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution Pie */}
        {statusData.length > 0 && (
          <Card className="border-2 bg-card/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Severity Distribution Pie */}
        {severityData.length > 0 && (
          <Card className="border-2 bg-card/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {severityData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Bar Chart */}
      {categoryData.length > 0 && (
        <Card className="border-2 bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reports by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Executive Summary</CardTitle>
          <CardDescription>
            {new Date(report.period_start).toLocaleDateString("en-IN")} – {new Date(report.period_end).toLocaleDateString("en-IN")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{report.summary}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportDetailView;
