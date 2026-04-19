import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, FileText, BarChart2, Upload, AlertTriangle, FileQuestion, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth";
import { useLang } from "@/contexts/language";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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

function getNotifRoute(n: Notification): string {
  switch (n.type) {
    case "new_permit":       return n.resourceId ? `/permits/${n.resourceId}` : "/permits";
    case "new_survey":       return "/surveys";
    case "new_final_report": return "/final-reports";
    case "new_objection":    return n.resourceId ? `/ppid/objections/${n.resourceId}` : "/ppid/objections";
    case "new_info_request": return n.resourceId ? `/ppid/information-requests/${n.resourceId}` : "/ppid/information-requests";
    default:                 return "/";
  }
}

function NotifIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 shrink-0 mt-0.5";
  switch (type) {
    case "new_permit":       return <FileText className={cn(cls, "text-chart-4")} />;
    case "new_survey":       return <BarChart2 className={cn(cls, "text-chart-2")} />;
    case "new_final_report": return <Upload className={cn(cls, "text-chart-3")} />;
    case "new_objection":    return <AlertTriangle className={cn(cls, "text-destructive")} />;
    case "new_info_request": return <FileQuestion className={cn(cls, "text-primary")} />;
    default:                 return <Megaphone className={cn(cls, "text-muted-foreground")} />;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    enabled: open && !!user,
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
    if (!notif.isReadByMe) markReadMutation.mutate(notif.id);
    setOpen(false);
    navigate(getNotifRoute(notif));
  }

  const formatTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return t("justNow");
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t("minutesAgo")}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t("hoursAgo")}`;
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short" });
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen(v => !v)}
        data-testid="button-notification-bell"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground border-0 pointer-events-none"
            data-testid="badge-notification-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">{t("notifications")}</h3>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline disabled:opacity-50"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-25" />
                <p>{t("noNotifications")}</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start gap-3",
                    !notif.isReadByMe && "bg-primary/5"
                  )}
                  onClick={() => handleNotifClick(notif)}
                  data-testid={`notif-item-${notif.id}`}
                >
                  <NotifIcon type={notif.type} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-tight mb-0.5 truncate", !notif.isReadByMe ? "font-semibold" : "font-medium")}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{formatTime(notif.createdAt)}</p>
                  </div>
                  {!notif.isReadByMe && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 text-center">
              <span className="text-[11px] text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} ${t("unreadNotifications")}` : t("allRead")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
