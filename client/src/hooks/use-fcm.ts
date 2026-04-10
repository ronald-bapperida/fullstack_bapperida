import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  isFirebaseConfigured,
  requestNotificationPermission,
  registerServiceWorkerAndGetToken,
  onForegroundMessage,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook to manage FCM push notification registration for authenticated admin users.
 * Call this in the main authenticated layout after login.
 */
export function useFcm(userId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const registered = useRef(false);

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("POST", "/api/fcm/token", { token, deviceType: "web", platform: "admin" }),
  });

  useEffect(() => {
    if (!userId || registered.current) return;
    if (!isFirebaseConfigured()) return;

    let unsubscribeForeground: (() => void) | null = null;

    async function setup() {
      try {
        const permission = await requestNotificationPermission();
        if (permission !== "granted") return;

        const token = await registerServiceWorkerAndGetToken();
        if (!token) return;

        registered.current = true;
        saveTokenMutation.mutate(token);

        // Listen for foreground messages
        unsubscribeForeground = onForegroundMessage((payload) => {
          const title = payload.notification?.title || "BAPPERIDA";
          const body = payload.notification?.body || "";
          toast({ title, description: body });
          qc.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
        });
      } catch (err) {
        console.warn("[FCM] Setup error:", err);
      }
    }

    setup();

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [userId]);
}
