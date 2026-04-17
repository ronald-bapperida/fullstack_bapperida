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
      console.log("[FCM] Saving token to backend...");
      const res = await apiRequest("POST", "/api/fcm/token", { 
        token, 
        deviceType: "web", 
        platform: "admin" 
      });
      console.log("[FCM] Save response:", res);
      return res;
    },
    onSuccess: () => {
      console.log("[FCM] Token saved successfully!");
      toast({ title: "Notifikasi", description: "Push notification enabled" });
    },
    onError: (error: any) => {
      console.error("[FCM] Failed to save token:", error);
      toast({ 
        title: "Notifikasi Error", 
        description: error.message || "Gagal menyimpan token", 
        variant: "destructive" 
      });
    },
  });

  useEffect(() => {
    if (!userId || registered.current) {
      console.log("[FCM] Skipping - no userId or already registered");
      return;
    }

    console.log("[FCM] Starting setup for user:", userId);

    let unsubscribeForeground: (() => void) | null = null;

    async function setup() {
      try {
        // Fetch config dari server jika VITE_ vars tidak ada di build time
        const configured = await ensureFirebaseConfig();
        if (!configured) {
          console.log("[FCM] Firebase not configured, skipping");
          return;
        }

        console.log("[FCM] 1. Requesting notification permission...");
        const permission = await requestNotificationPermission();
        console.log("[FCM] Permission result:", permission);
        if (permission !== "granted") {
          console.log("[FCM] Permission denied");
          return;
        }

        console.log("[FCM] 2. Registering service worker...");
        const token = await registerServiceWorkerAndGetToken();
        console.log("[FCM] Token obtained:", token ? "yes (" + token.substring(0, 20) + "...)" : "no");
        if (!token) {
          console.log("[FCM] No token obtained");
          return;
        }

        registered.current = true;
        console.log("[FCM] 3. Saving token to backend...");
        await saveTokenMutation.mutateAsync(token);
        console.log("[FCM] Setup complete!");

        // Listen for foreground messages
        unsubscribeForeground = onForegroundMessage((payload) => {
          console.log("[FCM] Foreground message received:", payload);
          const title = payload.notification?.title || "BAPPERIDA";
          const body = payload.notification?.body || "";
          toast({ title, description: body });
        });
      } catch (err) {
        console.error("[FCM] Setup error:", err);
      }
    }

    setup();

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [userId, saveTokenMutation, toast]);
}