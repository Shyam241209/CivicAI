import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight, Building2, User, FileText, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const actionMeta: Record<string, { label: string; icon: any; color: string }> = {
  status_change: { label: "Status", icon: RefreshCw, color: "text-primary" },
  assignment_change: { label: "Assignment", icon: Building2, color: "text-accent-foreground" },
  remarks_change: { label: "Remarks", icon: FileText, color: "text-muted-foreground" },
};

export const ReportAuditTrail = ({ reportId }: { reportId: string }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: logs }, { data: deps }] = await Promise.all([
        supabase
          .from("report_audit_logs" as any)
          .select("*")
          .eq("report_id", reportId)
          .order("created_at", { ascending: false }),
        supabase.from("departments").select("id,name"),
      ]);
      if (!active) return;
      setEntries((logs as any[]) || []);
      const map: Record<string, string> = {};
      ((deps as any[]) || []).forEach((d) => (map[d.id] = d.name));
      setDepartments(map);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [reportId]);

  const renderValue = (entry: AuditEntry, raw: string | null) => {
    if (!raw) return <span className="text-muted-foreground italic">empty</span>;
    if (entry.field === "assigned_department_id") {
      return <span>{departments[raw] || raw.slice(0, 8)}</span>;
    }
    if (entry.field === "admin_remarks") {
      return <span className="line-clamp-1 max-w-[180px]">{raw}</span>;
    }
    return <span className="capitalize">{raw.replace(/_/g, " ")}</span>;
  };

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" /> Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ol className="relative border-l-2 border-muted ml-2 space-y-4">
            {entries.map((e) => {
              const meta = actionMeta[e.action] || { label: e.action, icon: History, color: "text-foreground" };
              const Icon = meta.icon;
              return (
                <li key={e.id} className="ml-4 pl-2">
                  <span className="absolute -left-[11px] w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <Icon className={`w-2.5 h-2.5 ${meta.color}`} />
                  </span>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                    <span className="text-muted-foreground">{e.field?.replace(/_/g, " ")}:</span>
                    {renderValue(e, e.old_value)}
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{renderValue(e, e.new_value)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <User className="w-3 h-3" />
                    {e.actor_id ? <span>{e.actor_id.slice(0, 8)}…</span> : <span>system</span>}
                    <span>·</span>
                    <span>{format(new Date(e.created_at), "MMM d, yyyy h:mm a")}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
