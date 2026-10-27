import { StorageImage } from "@/components/StorageImage";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Search, MapPin, Calendar, Building2, ChevronDown, X, Sparkles, AlertCircle, XCircle, CheckCheck } from "lucide-react";
import { AssignDepartmentDialog } from "@/components/admin/AssignDepartmentDialog";
import { useToast } from "@/hooks/use-toast";
import { autoRouteUnassignedReports } from "@/lib/reportWorkflow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const STATUS_OPTIONS = ["pending", "in_progress", "resolved", "rejected"];

const AdminComplaints = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargets, setAssignTargets] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: rs }, { data: deps }] = await Promise.all([
      supabase.from("civic_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").order("name"),
    ]);
    const nextReports = (rs as any[]) || [];
    const routingResults = await Promise.all(nextReports.map((report) => autoRouteUnassignedReports(report)));
    const routedById = new Map(
      nextReports.map((report, index) => [report.id, routingResults[index]?.departmentId || null]),
    );
    setReports(nextReports.map((report) => ({
      ...report,
      assigned_department_id: report.assigned_department_id || routedById.get(report.id),
    })));
    setDepartments((deps as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const categories = useMemo(() => Array.from(new Set(reports.map((r) => r.issue_category).filter(Boolean))), [reports]);

  const filtered = reports.filter((r) => {
    if (status !== "all" && (r.status || "pending") !== status) return false;
    if (category !== "all" && r.issue_category !== category) return false;
    if (severity !== "all" && r.severity !== severity) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.short_description || ""} ${r.user_description || ""} ${r.issue_category || ""} ${JSON.stringify(r.location_data || {})}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someChecked = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkSetStatus = async (newStatus: string) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const results = await Promise.all(ids.map((id) => supabase.rpc("transition_civic_report_status", {
      p_report_id: id,
      p_status: newStatus.toUpperCase(),
    })));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast({ title: "Update failed", description: failed.error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Updated ${ids.length} complaints`, description: `Status set to ${newStatus.replace("_", " ")}` });
    setSelected(new Set());
    fetchAll();
  };

  const openBulkAssign = () => {
    if (selected.size === 0) return;
    setAssignTargets(Array.from(selected));
    setAssignOpen(true);
  };

  const openSingleAssign = (id: string) => {
    setAssignTargets([id]);
    setAssignOpen(true);
  };

  const depName = (id?: string | null) => (id ? departments.find((d) => d.id === id)?.name : null);

  const confirmRouting = async (id: string) => {
    const { error } = await supabase
      .from("civic_reports")
      .update({ auto_assign_pending_confirmation: false })
      .eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Routing confirmed" });
    fetchAll();
  };

  const rejectRouting = async (r: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const suggestion = r.auto_assign_suggested_name || r.suggested_department || "unknown";
    const conf = typeof r.auto_assign_confidence === "number"
      ? `${(r.auto_assign_confidence * 100).toFixed(0)}%`
      : "n/a";
    const { error } = await supabase
      .from("civic_reports")
      .update({
        assigned_department_id: null,
        auto_assign_pending_confirmation: false,
        auto_assign_match_method: "rejected",
      })
      .eq("id", r.id);
    if (error) { toast({ title: "Reject failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("report_audit_logs" as any).insert({
      report_id: r.id,
      actor_id: user?.id ?? null,
      action: "assignment_change",
      field: "auto_assign_pending_confirmation",
      old_value: "pending",
      new_value: "rejected",
      note: `Rejected AI suggestion "${suggestion}" (${conf})`,
    });
    toast({ title: "AI suggestion rejected", description: "Please reassign manually." });
    openSingleAssign(r.id);
    fetchAll();
  };

  return (
    <AdminLayout title="All Complaints">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total", value: reports.length, color: "text-foreground" },
          { label: "Pending", value: reports.filter((r) => (r.status || "pending") === "pending").length, color: "text-yellow-600" },
          { label: "In progress", value: reports.filter((r) => r.status === "in_progress").length, color: "text-blue-600" },
          { label: "Resolved", value: reports.filter((r) => r.status === "resolved").length, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search description, category, location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:col-span-4"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Bulk actions toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 p-3 rounded-2xl border-2 border-primary/30 bg-primary/5 backdrop-blur-md shadow-sm">
          <Badge className="bg-primary text-primary-foreground rounded-full">{selected.size} selected</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-xl">
                Set status <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Change status to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => bulkSetStatus(s)} className="capitalize">
                  {s.replace("_", " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={openBulkAssign} className="rounded-xl">
            <Building2 className="w-4 h-4 mr-1.5" /> Assign department
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="rounded-xl ml-auto">
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Select-all bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1 mb-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allChecked ? true : someChecked ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            aria-label="Select all"
          />
          <span>Select all {filtered.length}</span>
        </div>
      )}

      <div className="grid gap-3">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No complaints match the filters.</p>}
        {filtered.map((r) => (
          <Card key={r.id} className={`rounded-2xl transition-all ${selected.has(r.id) ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}>
            <CardContent className="p-4 flex gap-4">
              <div className="pt-1">
                <Checkbox
                  checked={selected.has(r.id)}
                  onCheckedChange={() => toggleOne(r.id)}
                  aria-label="Select complaint"
                />
              </div>
              <Link to={`/admin/complaints/${r.id}`} className="flex gap-4 flex-1 min-w-0">
                {r.image_url && <StorageImage path={r.image_url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold truncate">{r.short_description || r.issue_category || "Complaint"}</p>
                    <Badge className={statusColor[r.status || "pending"]} variant="outline">{(r.status || "pending").replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.user_description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {r.issue_category && <span className="px-2 py-0.5 rounded bg-muted">{r.issue_category}</span>}
                    {r.severity && <span className="px-2 py-0.5 rounded bg-muted capitalize">{r.severity}</span>}
                    {depName(r.assigned_department_id) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        <Building2 className="w-3 h-3" /> Routed to {depName(r.assigned_department_id)}
                        {typeof r.auto_assign_confidence === "number" && (
                          <span className="opacity-70">({Math.round(r.auto_assign_confidence * 100)}%)</span>
                        )}
                        {r.auto_assign_created_department && (
                          <Sparkles className="w-3 h-3 ml-0.5" />
                        )}
                      </span>
                    )}
                    {r.auto_assign_pending_confirmation && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10 text-warning font-medium">
                        <AlertCircle className="w-3 h-3" /> Awaiting routing review
                      </span>
                    )}
                    {r.location_data?.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location_data.address}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {/* Full AI auto-assignment audit details, visible without opening detail page */}
                  {(r.auto_assign_suggested_name || r.auto_assign_match_method) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" /> AI audit:
                      </span>
                      {r.auto_assign_suggested_name && (
                        <span>Suggested: <span className="font-medium text-foreground">{r.auto_assign_suggested_name}</span></span>
                      )}
                      {r.auto_assign_match_method && (
                        <span>Method: <span className="capitalize">{r.auto_assign_match_method.replace(/_/g, " ")}</span></span>
                      )}
                      {typeof r.auto_assign_confidence === "number" && (
                        <span>Confidence: <span className="font-medium text-foreground">{Math.round(r.auto_assign_confidence * 100)}%</span></span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex flex-col items-end gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openSingleAssign(r.id)}>
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  {r.assigned_department_id ? "Reassign" : "Assign"}
                </Button>
                {r.auto_assign_pending_confirmation && (
                  <>
                    <Button size="sm" className="rounded-xl" onClick={() => confirmRouting(r.id)}>
                      <CheckCheck className="w-3.5 h-3.5 mr-1" /> Confirm
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => rejectRouting(r)}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AssignDepartmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        reportIds={assignTargets}
        onAssigned={() => { setSelected(new Set()); fetchAll(); }}
      />
    </AdminLayout>
  );
};

export default AdminComplaints;