import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OfflineReport {
  id: string;
  savedAt: string;
  imageDataUrl: string | null;
  imageName: string | null;
  description: string;
  location: string;
  locationCoords: { lat: number; lng: number } | null;
  analysisResult: Record<string, unknown>;
}

const STORAGE_KEY = "civicai_offline_reports";

export function useOfflineReports() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingReports, setPendingReports] = useState<OfflineReport[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load pending reports from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPendingReports(JSON.parse(stored));
    } catch {
      console.error("Failed to load offline reports");
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "Back Online", description: "You can now submit your saved reports." });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: "You're Offline", description: "Reports will be saved locally until you're back online.", variant: "destructive" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  const saveOffline = useCallback((report: Omit<OfflineReport, "id" | "savedAt">) => {
    const newReport: OfflineReport = {
      ...report,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    };
    const updated = [...pendingReports, newReport];
    setPendingReports(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast({ title: "Saved Offline", description: "Your report has been saved locally and will be submitted when you're back online." });
    return newReport;
  }, [pendingReports, toast]);

  const removePending = useCallback((id: string) => {
    const updated = pendingReports.filter((r) => r.id !== id);
    setPendingReports(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [pendingReports]);

  const dataUrlToFile = async (dataUrl: string, name: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type });
  };

  const syncReport = useCallback(async (report: OfflineReport): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      let imageUrl = "";
      if (report.imageDataUrl && report.imageName) {
        const file = await dataUrlToFile(report.imageDataUrl, report.imageName);
        const fileName = `${user.id}/${crypto.randomUUID()}.${report.imageName.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("civic-reports")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        imageUrl = fileName;
      }

      const ar = report.analysisResult as Record<string, unknown>;
      const locationData = report.locationCoords
        ? { ...report.locationCoords, address: report.location }
        : report.location ? { address: report.location } : null;

      const { error } = await supabase.from("civic_reports").insert({
        user_id: user.id,
        image_url: imageUrl,
        user_description: report.description,
        location_data: locationData,
        issue_category: ar.issue_category as string,
        severity: ar.severity as string,
        priority_level: ar.priority_level as string,
        short_description: ar.short_description as string,
        suggested_department: ar.suggested_department as string,
        context_analysis: ar.context_analysis as string,
        estimated_resolution_time: ar.estimated_resolution_time as string,
        recommended_action: ar.recommended_action as string,
        ai_confidence_score: ar.ai_confidence_score as number,
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Failed to sync report:", err);
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (pendingReports.length === 0 || !navigator.onLine) return;
    setIsSyncing(true);

    let synced = 0;
    for (const report of pendingReports) {
      const success = await syncReport(report);
      if (success) {
        removePending(report.id);
        synced++;
      }
    }

    setIsSyncing(false);
    if (synced > 0) {
      toast({ title: "Reports Synced", description: `${synced} offline report(s) submitted successfully.` });
    }
  }, [pendingReports, removePending, toast, syncReport]);

  return {
    isOnline,
    pendingReports,
    isSyncing,
    saveOffline,
    removePending,
    syncAll,
    pendingCount: pendingReports.length,
  };
}
