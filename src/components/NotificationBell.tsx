import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  report_id: string | null;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const { user } = useAuth();
  const { permission, showLocalNotification } = usePushNotifications();

  // Keep push helpers in refs so the realtime channel subscribes once per user
  // instead of tearing down / re-subscribing on every permission change.
  const permissionRef = useRef(permission);
  const showRef = useRef(showLocalNotification);
  permissionRef.current = permission;
  showRef.current = showLocalNotification;

  useEffect(() => {
    if (!user) return;
    let active = true;
    setUnavailable(false);
    void fetchNotifications().then((success) => {
      if (active && !success) setUnavailable(true);
    });

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);

          // Show push notification if permission granted and tab not focused
          if (permissionRef.current === "granted" && document.hidden) {
            showRef.current(
              newNotif.title,
              newNotif.message,
              newNotif.report_id ? `/report/${newNotif.report_id}` : "/dashboard"
            );
          }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setUnavailable(true);
          if (import.meta.env.DEV) console.error("Notification realtime unavailable", status);
        }
      });

    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message,type,is_read,created_at,report_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
    if (error && import.meta.env.DEV) console.error("Unable to load notifications", error);
    return !error;
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unread);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-7">
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {unavailable ? (
            <p className="text-sm text-muted-foreground text-center py-8">Notifications unavailable</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
                onClick={() => markAsRead(n.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
