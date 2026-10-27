import { useState, useEffect, useCallback } from "react";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      navigator.serviceWorker
        .register("/sw-push.js")
        .then((reg) => {
          setRegistration(reg);
        })
        .catch((err) => {
          console.warn("SW registration failed:", err);
        });
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch {
      return false;
    }
  }, [isSupported]);

  const showLocalNotification = useCallback(
    (title: string, body: string, url?: string) => {
      if (!registration || permission !== "granted") return;

      registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: { url: url || "/dashboard" },
        tag: "civicai-" + Date.now(),
      } as NotificationOptions);
    },
    [registration, permission]
  );

  return {
    isSupported,
    permission,
    requestPermission,
    showLocalNotification,
    registration,
  };
};
