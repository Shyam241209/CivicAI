import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, UserPlus, UserMinus, RefreshCw, Shield } from "lucide-react";

interface ActivityLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case "status_change": return <RefreshCw className="w-4 h-4 text-primary" />;
    case "admin_invite": return <UserPlus className="w-4 h-4 text-success" />;
    case "admin_remove": return <UserMinus className="w-4 h-4 text-destructive" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActionBadge = (action: string) => {
  switch (action) {
    case "status_change": return <Badge variant="secondary">Status Change</Badge>;
    case "admin_invite": return <Badge className="bg-success/10 text-success border-success/20">Invite</Badge>;
    case "admin_remove": return <Badge variant="destructive">Removal</Badge>;
    default: return <Badge variant="outline">{action}</Badge>;
  }
};

const AdminActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-2 bg-card/95 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-primary" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No activity recorded yet</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl border bg-background/50"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getActionBadge(log.action)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{log.details || "No details"}</p>
                  {log.target_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.target_type}: {log.target_id.slice(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminActivityLog;
