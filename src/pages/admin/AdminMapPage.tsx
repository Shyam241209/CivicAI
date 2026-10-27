import { AdminLayout } from "@/components/AdminLayout";
import { AdminMapView } from "@/components/AdminMapView";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { autoRouteUnassignedReports } from "@/lib/reportWorkflow";

const AdminMapPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const { toast } = useToast();
  const fetchReports = useCallback(async () => {
    {
      const { data } = await supabase
        .from("civic_reports")
        .select(
          "id,image_url,user_description,issue_category,severity,priority_level,short_description,status,created_at,location_data,assigned_department_id,suggested_department"
        )
        .order("created_at", { ascending: false })
        .limit(300);
      const nextReports = data || [];
      const routingResults = await Promise.all(nextReports.map((report) => autoRouteUnassignedReports(report)));
      const routedById = new Map(
        nextReports.map((report, index) => [report.id, routingResults[index]?.departmentId || null]),
      );
      setReports(nextReports.map((report) => ({
        ...report,
        assigned_department_id: report.assigned_department_id || routedById.get(report.id),
      })));
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  const handleStatusUpdate = async (reportId: string, status: string) => {
    const { error } = await supabase.rpc("transition_civic_report_status", {
      p_report_id: reportId,
      p_status: status.toUpperCase(),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    toast({ title: "Status updated" });
  };
  return (
    <AdminLayout title="Map View">
      <div className="h-[calc(100vh-8rem)]">
        <AdminMapView reports={reports} onStatusUpdate={handleStatusUpdate} onRefresh={fetchReports} />
      </div>
    </AdminLayout>
  );
};

export default AdminMapPage;