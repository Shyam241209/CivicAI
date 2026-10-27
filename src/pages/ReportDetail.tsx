import { StorageImage } from "@/components/StorageImage";
import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { AssignDepartmentDialog } from "@/components/admin/AssignDepartmentDialog";
import { ReportAuditTrail } from "@/components/admin/ReportAuditTrail";
import {
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  Share2,
  Copy,
  Twitter,
  Facebook,
  ArrowLeft,
  CheckCircle2,
  Timer,
  Building2,
  Save,
  Sparkles,
  AlertCircle,
  CheckCheck,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReportData {
  id: string;
  image_url: string | null;
  user_description: string | null;
  issue_category: string | null;
  severity: string | null;
  short_description: string | null;
  status: string | null;
  created_at: string;
  estimated_resolution_time: string | null;
  suggested_department: string | null;
  context_analysis: string | null;
  assigned_department_id: string | null;
  assigned_officer: string | null;
  admin_remarks: string | null;
  auto_assign_suggested_name: string | null;
  auto_assign_match_method: string | null;
  auto_assign_confidence: number | null;
  auto_assign_pending_confirmation: boolean | null;
  auto_assign_created_department: boolean | null;
  resolution_image_url: string | null;
  location_data: {
    lat?: number;
    lng?: number;
    address?: string;
  } | null;
}

interface StatusHistoryEntry {
  id: string;
  report_id: string;
  status: "SUBMITTED" | "VERIFIED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  message: string | null;
  department_id: string | null;
  changed_at: string;
}

const timelineSteps: StatusHistoryEntry["status"][] = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

const getSeverityColor = (severity: string | null) => {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive" as const;
    case "moderate":
      return "default" as const;
    default:
      return "secondary" as const;
  }
};

const getStatusConfig = (status: string | null) => {
  switch (status) {
    case "pending":
    case "submitted":
      return { label: "Submitted", color: "bg-warning text-warning-foreground" };
    case "verified":
      return { label: "Verified", color: "bg-primary text-primary-foreground" };
    case "assigned":
      return { label: "Assigned", color: "bg-primary text-primary-foreground" };
    case "in_review":
      return { label: "In Review", color: "bg-primary text-primary-foreground" };
    case "in_progress":
      return { label: "In Progress", color: "bg-primary text-primary-foreground" };
    case "resolved":
      return { label: "Resolved", color: "bg-success text-success-foreground" };
    default:
      return { label: status || "Unknown", color: "bg-secondary text-secondary-foreground" };
  }
};

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin/");
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [statusRejectOpen, setStatusRejectOpen] = useState(false);
  const [statusRejecting, setStatusRejecting] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("civic_reports")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      setNotFound(true);
    } else {
      const r = data as ReportData;
      setReport(r);
      setAdminRemarks(r.admin_remarks || "");
      if (r.assigned_department_id) {
        const { data: d } = await supabase.from("departments").select("name").eq("id", r.assigned_department_id).maybeSingle();
        const departmentRow = d as { name?: string } | null;
        setDepartmentName(departmentRow?.name ?? null);
      } else {
        setDepartmentName(null);
      }
    }
    setIsLoading(false);
  }, [id]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("report_status_history" as any)
      .select("id, report_id, status, message, department_id, changed_at")
      .eq("report_id", id)
      .order("changed_at", { ascending: true });
    setStatusHistory((data as StatusHistoryEntry[]) || []);
  }, [id]);

  useEffect(() => {
    fetchReport();
    fetchStatusHistory();
    if (!id) return;

    const channel = supabase
      .channel(`report-tracking-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "civic_reports", filter: `id=eq.${id}` }, () => {
        fetchReport();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "report_status_history", filter: `report_id=eq.${id}` }, () => {
        fetchStatusHistory();
        fetchReport();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchReport, fetchStatusHistory, id]);

  const updateStatus = async (newStatus: string) => {
    if (!report) return;
    if (newStatus === "rejected") {
      setStatusRejectOpen(true);
      return;
    }
    if (newStatus === "resolved" && !report.resolution_image_url) {
      toast({ title: "Resolution evidence required", description: "Upload an after photo before resolving this report.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc("transition_civic_report_status", {
      p_report_id: report.id,
      p_status: newStatus.toUpperCase(),
    });
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status updated", description: newStatus.replace("_", " ") });
    fetchReport();
    fetchStatusHistory();
  };

  const rejectReport = async () => {
    if (!report || !rejectNote.trim()) return;
    setStatusRejecting(true);
    const { error } = await supabase.rpc("transition_civic_report_status", {
      p_report_id: report.id,
      p_status: "REJECTED",
      p_message: rejectNote.trim(),
    });
    setStatusRejecting(false);
    if (error) {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
      return;
    }
    setStatusRejectOpen(false);
    setRejectNote("");
    toast({ title: "Report rejected" });
    fetchReport();
    fetchStatusHistory();
  };

  const uploadResolutionEvidence = async (file: File) => {
    if (!report || !isAdminRoute) return;
    setUploadingEvidence(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${report.id}/resolution-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("civic-reports").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setUploadingEvidence(false);
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { error: updateError } = await supabase.from("civic_reports").update({ resolution_image_url: path }).eq("id", report.id);
    setUploadingEvidence(false);
    if (updateError) {
      toast({ title: "Evidence save failed", description: updateError.message, variant: "destructive" });
      return;
    }
    toast({ title: "Resolution evidence uploaded" });
    fetchReport();
  };

  const saveRemarks = async () => {
    if (!report) return;
    setSavingRemarks(true);
    const { error } = await supabase.from("civic_reports").update({ admin_remarks: adminRemarks }).eq("id", report.id);
    setSavingRemarks(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Remarks saved" });
    fetchReport();
  };

  const confirmAutoAssign = async () => {
    if (!report) return;
    const { error } = await supabase
      .from("civic_reports")
      .update({ auto_assign_pending_confirmation: false })
      .eq("id", report.id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Auto-assignment confirmed" });
    fetchReport();
  };

  const rejectAutoAssign = async () => {
    if (!report) return;
    setRejecting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const suggestion = report.auto_assign_suggested_name || report.suggested_department || "unknown";
    const conf = typeof report.auto_assign_confidence === "number"
      ? `${(report.auto_assign_confidence * 100).toFixed(0)}%`
      : "n/a";
    const note = `Rejected AI suggestion "${suggestion}" (${conf}). ${rejectNote.trim() || ""}`.trim();

    // Clear AI assignment + audit metadata so admin can manually reassign.
    const { error } = await supabase
      .from("civic_reports")
      .update({
        assigned_department_id: null,
        auto_assign_pending_confirmation: false,
        auto_assign_match_method: "rejected",
      })
      .eq("id", report.id);
    if (error) {
      setRejecting(false);
      toast({ title: "Reject failed", description: error.message, variant: "destructive" });
      return;
    }
    // Write audit outcome.
    await supabase.from("report_audit_logs").insert({
      report_id: report.id,
      actor_id: user?.id ?? null,
      action: "assignment_change",
      field: "auto_assign_pending_confirmation",
      old_value: "pending",
      new_value: "rejected",
      note,
    });
    setRejecting(false);
    setRejectOpen(false);
    setRejectNote("");
    toast({ title: "AI suggestion rejected", description: "You can now reassign manually." });
    setAssignOpen(true);
    fetchReport();
  };

  const shareUrl = window.location.href;
  const shareText = report
    ? `Civic Issue: ${report.issue_category} — ${report.short_description}${report.location_data?.address ? ` at ${report.location_data.address}` : ""}. Status: ${report.status}`
    : "";

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    isAdminRoute ? (
      <AdminLayout title="Complaint Details">{children}</AdminLayout>
    ) : (
      <AppLayout overlay="medium">{children}</AppLayout>
    );

  if (isLoading) {
    return (
      <Wrapper>
        <div className="py-8 px-4 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </Wrapper>
    );
  }

  if (notFound || !report) {
    return (
      <Wrapper>
        <div className="py-16 px-4 text-center max-w-lg mx-auto">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Report Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This report may have been removed or the link is invalid.
          </p>
          <Button asChild>
            <Link to={isAdminRoute ? "/admin/complaints" : "/"}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Link>
          </Button>
        </div>
      </Wrapper>
    );
  }

  const statusConfig = getStatusConfig(report.status);
  const locationDisplay = report.location_data?.address || null;
  const currentStatus = (report.status || "pending").toUpperCase() as StatusHistoryEntry["status"];
  const historyByStatus = new Map(statusHistory.map((entry) => [entry.status, entry]));
  if (statusHistory.length === 0) {
    historyByStatus.set("SUBMITTED", {
      id: `created-${report.id}`,
      report_id: report.id,
      status: "SUBMITTED",
      message: "Your civic report was successfully submitted.",
      department_id: null,
      changed_at: report.created_at,
    });
  }
  const currentTimelineIndex = currentStatus === "REJECTED"
    ? timelineSteps.length
    : Math.max(0, timelineSteps.indexOf(currentStatus));

  return (
    <Wrapper>
      <div className={isAdminRoute ? "" : "py-6 md:py-10 px-4"}>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back + Share header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link to={isAdminRoute ? "/admin/complaints" : "/"}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="w-4 h-4" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                    toast({ title: "Copied!", description: "Report link copied to clipboard" });
                  }}
                >
                  <Copy className="w-4 h-4" /> Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.4 0-4.636-.817-6.407-2.19l-.147-.117-3.054 1.024 1.024-3.054-.117-.147A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank")}
                >
                  <Twitter className="w-4 h-4" /> Twitter / X
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank")}
                >
                  <Facebook className="w-4 h-4" /> Facebook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Image */}
          {report.image_url && (
            <div className="overflow-hidden rounded-2xl">
              <StorageImage
                path={report.image_url}
                alt="Civic issue"
                className="w-full max-h-[400px] object-cover"
              />
            </div>
          )}

          <Card className="border-2 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resolution Evidence</CardTitle>
              <p className="text-xs text-muted-foreground">The original report photo is shown as before evidence.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Before</p>
                  {report.image_url ? <StorageImage path={report.image_url} alt="Before evidence" className="w-full aspect-video rounded-xl object-cover" /> : <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">No original photo</div>}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">After</p>
                  {report.resolution_image_url ? <StorageImage path={report.resolution_image_url} alt="Resolution evidence" className="w-full aspect-video rounded-xl object-cover" /> : <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">Waiting for resolution evidence</div>}
                </div>
              </div>
              {isAdminRoute && (
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">
                  {uploadingEvidence ? "Uploading…" : report.resolution_image_url ? "Replace after photo" : "Upload after photo"}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploadingEvidence} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadResolutionEvidence(file); event.currentTarget.value = ""; }} />
                </label>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Report Tracking</CardTitle>
              <p className="text-xs text-muted-foreground">Civic Report #{report.id.slice(0, 8).toUpperCase()}</p>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-2 border-l-2 border-muted space-y-5">
                {(currentStatus === "REJECTED" ? [...timelineSteps, "REJECTED" as const] : timelineSteps).map((step, index) => {
                  const entry = historyByStatus.get(step);
                  const complete = Boolean(entry) && (currentStatus === "REJECTED" || index <= currentTimelineIndex);
                  const current = step === currentStatus;
                  const label = step === "IN_PROGRESS" ? "Work In Progress" : step.replace(/_/g, " ");
                  return (
                    <li key={step} className="relative ml-5 pl-2">
                      <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background ${complete ? "border-primary text-primary" : "border-muted text-muted-foreground"} ${current ? "ring-4 ring-primary/15" : ""}`}>
                        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                      </span>
                      <p className={`text-sm font-semibold capitalize ${current ? "text-primary" : complete ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                      {entry ? (
                        <>
                          <p className="text-xs text-muted-foreground">{format(new Date(entry.changed_at), "dd MMM yyyy • h:mm a")}</p>
                          {entry.message && <p className="mt-1 text-xs text-muted-foreground">{entry.message}</p>}
                          {step === "ASSIGNED" && departmentName && <p className="mt-1 text-xs font-medium text-primary">{departmentName}</p>}
                        </>
                      ) : <p className="text-xs text-muted-foreground">Waiting for this update</p>}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Main details */}
          <Card className="border-2 rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl md:text-2xl">{report.issue_category}</CardTitle>
                  <p className="text-muted-foreground mt-1">{report.short_description}</p>
                </div>
                <Badge variant={getSeverityColor(report.severity)} className="flex-shrink-0 text-sm">
                  {report.severity?.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Status */}
              <div className="flex items-center gap-3">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                {report.estimated_resolution_time && report.status !== "resolved" && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Timer className="w-4 h-4" /> ETA: {report.estimated_resolution_time}
                  </span>
                )}
              </div>

              {/* Description */}
              {report.user_description && (
                <div>
                  <h3 className="font-semibold text-sm mb-1.5">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{report.user_description}</p>
                </div>
              )}

              {/* Context Analysis */}
              {report.context_analysis && (
                <div>
                  <h3 className="font-semibold text-sm mb-1.5">AI Analysis</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{report.context_analysis}</p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(report.created_at), "MMM dd, yyyy 'at' h:mm a")}
                </div>
                {locationDisplay && (
                  <button
                    onClick={() => {
                      const loc = report.location_data!;
                      const query = loc.address
                        ? encodeURIComponent(loc.address)
                        : `${loc.lat},${loc.lng}`;
                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
                    }}
                    className="flex items-center gap-1.5 text-primary hover:underline transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    {locationDisplay}
                  </button>
                )}
                {report.suggested_department && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Suggested: {report.suggested_department}
                  </div>
                )}
              </div>

              {/* AI Auto-Assignment summary (visible to citizens & admins) */}
              {(report.auto_assign_match_method || report.assigned_department_id) && (
                <div className="mt-3 p-3 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-sm">
                    {departmentName ? (
                      <p className="font-semibold text-primary">
                        Routed to {departmentName}
                        {typeof report.auto_assign_confidence === "number" && (
                          <span className="font-normal text-muted-foreground ml-1">
                            ({(report.auto_assign_confidence * 100).toFixed(0)}%)
                          </span>
                        )}
                        {report.auto_assign_created_department && (
                          <Badge variant="outline" className="ml-2 text-[10px]">newly created</Badge>
                        )}
                      </p>
                    ) : report.auto_assign_pending_confirmation ? (
                      <p className="font-semibold text-warning">Awaiting routing review</p>
                    ) : (
                      <p className="text-muted-foreground">Not yet routed to a department.</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {report.auto_assign_suggested_name && (
                        <span>AI suggested: <span className="font-medium text-foreground">{report.auto_assign_suggested_name}</span></span>
                      )}
                      {report.auto_assign_match_method && (
                        <span>Method: <span className="capitalize">{report.auto_assign_match_method.replace(/_/g, " ")}</span></span>
                      )}
                      {typeof report.auto_assign_confidence === "number" && (
                        <span>Confidence: {(report.auto_assign_confidence * 100).toFixed(0)}%</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin tools */}
          {isAdminRoute && (
            <>
              {report.auto_assign_pending_confirmation && (
                <Card className="border-2 border-warning/40 bg-warning/5 rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">Low-confidence auto-assignment</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          AI suggested <strong>{report.auto_assign_suggested_name || report.suggested_department}</strong>
                          {typeof report.auto_assign_confidence === "number" && ` with ${(report.auto_assign_confidence * 100).toFixed(0)}% confidence`}.
                          Please review and confirm, reassign, or reject.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={confirmAutoAssign} className="rounded-lg">
                        <CheckCheck className="w-4 h-4 mr-1.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} className="rounded-lg">
                        <Building2 className="w-4 h-4 mr-1.5" /> Reassign
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} className="rounded-lg">
                        <XCircle className="w-4 h-4 mr-1.5" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-2 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Assignment & Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Assigned Department</p>
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/50">
                        <span className="font-medium">{departmentName || <span className="text-muted-foreground italic">Unassigned</span>}</span>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setAssignOpen(true)}>
                          {report.assigned_department_id ? "Reassign" : "Assign"}
                        </Button>
                      </div>
                      {report.assigned_officer && (
                        <p className="text-xs text-muted-foreground mt-1.5">Officer: <strong>{report.assigned_officer}</strong></p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Status</p>
                        <Select value={report.status || "pending"} onValueChange={updateStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Admin Remarks</p>
                    <Textarea
                      rows={3}
                      placeholder="Internal notes for the assigned team…"
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                      <Button size="sm" onClick={saveRemarks} disabled={savingRemarks || adminRemarks === (report.admin_remarks || "")} className="rounded-lg">
                        <Save className="w-4 h-4 mr-1.5" /> {savingRemarks ? "Saving…" : "Save remarks"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ReportAuditTrail reportId={report.id} />

              <AssignDepartmentDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                reportIds={[report.id]}
                onAssigned={fetchReport}
              />

              {/* Reject AI suggestion dialog */}
              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-destructive" /> Reject AI suggestion
                    </DialogTitle>
                    <DialogDescription>
                      Clears the suggested department and records why. You'll be prompted to reassign.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="text-sm p-3 rounded-lg bg-muted/50 space-y-1">
                      <p>AI suggested: <strong>{report.auto_assign_suggested_name || report.suggested_department || "—"}</strong></p>
                      {report.auto_assign_match_method && (
                        <p className="text-xs text-muted-foreground">
                          Method: <span className="capitalize">{report.auto_assign_match_method.replace(/_/g, " ")}</span>
                          {typeof report.auto_assign_confidence === "number" && ` · ${(report.auto_assign_confidence * 100).toFixed(0)}% confidence`}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Reason (optional)</p>
                      <Textarea
                        rows={3}
                        placeholder="Why is this suggestion incorrect?"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Cancel</Button>
                    <Button variant="destructive" onClick={rejectAutoAssign} disabled={rejecting}>
                      {rejecting ? "Rejecting…" : "Reject & Reassign"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={statusRejectOpen} onOpenChange={setStatusRejectOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject report</DialogTitle>
                    <DialogDescription>A reason is required and will be shown in the citizen timeline.</DialogDescription>
                  </DialogHeader>
                  <Textarea rows={4} placeholder="Explain why this report cannot be accepted…" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setStatusRejectOpen(false)} disabled={statusRejecting}>Cancel</Button>
                    <Button variant="destructive" onClick={() => void rejectReport()} disabled={statusRejecting || !rejectNote.trim()}>{statusRejecting ? "Rejecting…" : "Reject report"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </Wrapper>
  );
};

export default ReportDetail;
