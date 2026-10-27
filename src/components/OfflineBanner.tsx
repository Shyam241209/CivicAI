import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const OfflineBanner = () => {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online — syncing…");
    }
  }, [online]);

  if (online) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-sm py-2 px-4 flex items-center justify-center gap-2 shadow-md">
      <WifiOff className="w-4 h-4" />
      <span>You are offline. Changes will sync when the connection returns.</span>
    </div>
  );
};