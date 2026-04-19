import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ensureFirebaseConfig,
  requestNotificationPermission,
  registerServiceWorkerAndGetToken,
  onForegroundMessage,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export function useFcm(userId: string | undefined) {
  const { toast } = useToast();
  const registered = useRef(false);

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest("POST", "/api/fcm/token", {
        token,
        deviceType: "web",
        platform: "admin",
      });
    },
    onError: () => {
      toast({
        title: "Notifikasi Error",
        description: "Gagal menyimpan token perangkat",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!userId || registered.current) return;

    let unsubscribeForeground: (() => void) | null = null;

    async function setup() {
      try {
        const configured = await ensureFirebaseConfig();
        if (!configured) return;

        const permission = await requestNotificationPermission();
        if (permission !== "granted") return;

        const token = await registerServiceWorkerAndGetToken();
        if (!token) return;

        registered.current = true;
        await saveTokenMutation.mutateAsync(token);

        unsubscribeForeground = onForegroundMessage((payload) => {
          const title = payload.notification?.title || "BAPPERIDA";
          const body = payload.notification?.body || "";
          toast({ title, description: body });
        });
      } catch {
        // Silent — FCM is optional
      }
    }

    setup();

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [userId, saveTokenMutation, toast]);
}
