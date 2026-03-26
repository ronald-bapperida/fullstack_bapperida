import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceId?: string;
  resourceType?: string;
  targetRole: string;
  isRead: boolean;
  isReadByMe: boolean;
  createdAt: string;
};

const RESOURCE_LINKS: Record<string, (id: string) => string> = {
  permit: (id) => `/permits/${id}`,
  ppid_info_request: () => `/ppid`,
  ppid_objection: () => `/ppid`,
};

const TYPE_ICONS: Record<string, string> = {
  new_permit: "📋",
  new_info_request: "📄",
  new_objection: "⚠️",
  new_final_report: "📊",
  permit_status: "🔄",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/notifications/unread-count"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = countData?.count ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/admin/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNotifClick(notif: Notification) {
    markReadMutation.mutate(notif.id);
    setOpen(false);
    if (notif.resourceId && notif.resourceType && RESOURCE_LINKS[notif.resourceType]) {
      navigate(RESOURCE_LINKS[notif.resourceType](notif.resourceId));
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(v => !v)}
        data-testid="button-notification-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            variant="destructive"
            data-testid="badge-notification-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => markAllReadMutation.mutate()}
                data-testid="button-mark-all-read"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada notifikasi
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors ${!notif.isReadByMe ? "bg-primary/5" : ""}`}
                  onClick={() => handleNotifClick(notif)}
                  data-testid={`notif-item-${notif.id}`}
                >
                  <div className="flex gap-2 items-start">
                    <span className="text-base mt-0.5 shrink-0">{TYPE_ICONS[notif.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{notif.title}</p>
                        {!notif.isReadByMe && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-primary inline-block" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTime(notif.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
