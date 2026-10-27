import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  officer_name: string | null;
  max_active_complaints?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pass one or many report ids. If many, this becomes a bulk assignment. */
  reportIds: string[];
  onAssigned?: () => void;
}

export const AssignDepartmentDialog = ({ open, onOpenChange, reportIds, onAssigned }: Props) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [officer, setOfficer] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOver, setConfirmOver] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setDepartmentId("");
    setOfficer("");
    setRemarks("");
    setConfirmOver(false);
    setLoadingDepartments(true);
    setDepartmentError(null);
    (async () => {
      const [{ data: deps, error: departmentsError }, { data: counts, error: countsError }] = await Promise.all([
        supabase.from("departments").select("id,name,officer_name").order("name"),
        supabase
          .from("civic_reports")
          .select("assigned_department_id")
          .not("assigned_department_id", "is", null)
          .neq("status", "resolved")
          .neq("status", "rejected"),
      ]);
      if (departmentsError || countsError) {
        const error = departmentsError || countsError;
        const message = error?.message || "Failed to load department data.";
        setDepartments([]);
        setDepartmentError(message);
        toast({ title: "Unable to load departments", description: message, variant: "destructive" });
        setLoadingDepartments(false);
        return;
      }

      setDepartments((deps as Department[]) || []);
      const c: Record<string, number> = {};
      ((counts as any[]) || []).forEach((r: any) => {
        c[r.assigned_department_id] = (c[r.assigned_department_id] || 0) + 1;
      });
      setActiveCounts(c);
      setLoadingDepartments(false);
    })();
  }, [open, toast]);

  const selected = departments.find((d) => d.id === departmentId);
  const currentActive = selected ? activeCounts[selected.id] || 0 : 0;
  const projected = currentActive + reportIds.length;
  const cap = selected?.max_active_complaints ?? 50;
  const overCap = !!selected && projected > cap;

  const handleAssign = async () => {
    if (!departmentId) {
      toast({ title: "Pick a department", variant: "destructive" });
      return;
    }
    if (overCap && !confirmOver) {
      setConfirmOver(true);
      return;
    }
    setBusy(true);
    const update: any = {
      assigned_department_id: departmentId,
      is_auto_assigned: false,
      department_assignment_method: "manual_override",
      department_assignment_confidence: null,
      needs_admin_review: false,
    };
    if (officer.trim()) update.assigned_officer = officer.trim();
    if (remarks.trim()) update.admin_remarks = remarks.trim();

    const { data: currentReports, error: readError } = await supabase
      .from("civic_reports")
      .select("id,status")
      .in("id", reportIds);
    if (readError) {
      setBusy(false);
      toast({ title: "Assignment failed", description: readError.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("civic_reports").update(update).in("id", reportIds);
    if (!error) {
      const transitionResults = await Promise.all(
        ((currentReports as { id: string; status: string | null }[]) || [])
          .filter((report) => ["pending", "submitted", "in_review", "verified"].includes(report.status || "pending"))
          .map(async (report) => {
            const currentStatus = report.status || "pending";
            if (["pending", "submitted", "in_review"].includes(currentStatus)) {
              const verification = await supabase.rpc("transition_civic_report_status", {
                p_report_id: report.id,
                p_status: "VERIFIED",
              });
              if (verification.error) return verification;
            }
            return supabase.rpc("transition_civic_report_status", {
              p_report_id: report.id,
              p_status: "ASSIGNED",
              p_message: `Forwarded to ${selected?.name || "the responsible department"}.`,
            });
          })
      );
      const transitionError = transitionResults.find((result) => result.error)?.error;
      if (transitionError) {
        setBusy(false);
        toast({ title: "Assignment history failed", description: transitionError.message, variant: "destructive" });
        return;
      }
    }
    setBusy(false);
    if (error) {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: reportIds.length > 1 ? `Assigned ${reportIds.length} complaints` : "Complaint assigned",
      description: selected ? `Routed to ${selected.name}` : undefined,
    });
    onOpenChange(false);
    onAssigned?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {reportIds.length > 1 ? `Assign ${reportIds.length} complaints` : "Assign complaint"}
          </DialogTitle>
          <DialogDescription>Route to a department and optionally name a responsible officer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Department</Label>
            <Select
              value={departmentId}
              onValueChange={(v) => { setDepartmentId(v); setConfirmOver(false); }}
              disabled={loadingDepartments || !!departmentError || departments.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
              <SelectContent>
                {!loadingDepartments && !departmentError && departments.map((d) => {
                  const a = activeCounts[d.id] || 0;
                  const c = d.max_active_complaints || 50;
                  const full = a >= c;
                  return (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>{d.name}</span>
                        <span className={`text-xs ${full ? "text-destructive" : "text-muted-foreground"}`}>
                          {a}/{c}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {loadingDepartments && <p className="text-xs text-muted-foreground mt-1">Loading departments...</p>}
            {!loadingDepartments && !departmentError && departments.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No departments available</p>
            )}
            {departmentError && <p className="text-xs text-destructive mt-1">{departmentError}</p>}
            {selected && (
              <p className="text-xs text-muted-foreground mt-1">
                Current load: <strong>{currentActive}</strong> active · capacity <strong>{cap}</strong>
                {reportIds.length > 1 && <> · after assignment: <strong>{projected}</strong></>}
              </p>
            )}
          </div>

          <div>
            <Label>Officer (optional)</Label>
            <Input
              placeholder={selected?.officer_name || "Officer name"}
              value={officer}
              onChange={(e) => setOfficer(e.target.value)}
            />
          </div>

          <div>
            <Label>Remarks (optional)</Label>
            <Textarea
              rows={3}
              placeholder="Internal notes for the assigned team…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {overCap && (
            <div className="flex gap-3 p-3 rounded-lg border border-warning bg-warning/10 text-sm">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-warning-foreground">Over capacity</p>
                <p className="text-muted-foreground">
                  Assigning would push <strong>{selected?.name}</strong> to <strong>{projected}/{cap}</strong> active complaints.
                  {confirmOver ? " Click Assign Anyway to proceed." : " Click Assign once more to confirm."}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={handleAssign}
            disabled={busy || !departmentId}
            variant={overCap && confirmOver ? "destructive" : "default"}
          >
            {busy ? "Assigning…" : overCap && confirmOver ? "Assign Anyway" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
