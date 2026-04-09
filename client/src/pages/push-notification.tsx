import { useState } from "react";
import { useLang } from "@/contexts/language";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Send, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function PushNotificationPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <h2 className="text-xl font-bold">{t("accessDenied")}</h2>
        <p className="text-muted-foreground">{t("accessDeniedDesc")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/admin/notifications/broadcast", { title, message });
      toast({ title: t("notifSent"), description: t("notifSentDesc") });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      toast({ title: t("errorSaveData"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("pushNotifTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pushNotifSubtitle")}</p>
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-muted-foreground" />
            {t("notifTargetAll")}
          </CardTitle>
          <CardDescription>{t("notifTargetAllDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">{t("notifTitle")}</Label>
              <Input
                id="notif-title"
                placeholder={t("notifTitlePlaceholder")}
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                data-testid="input-notif-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notif-message">{t("notifMessage")}</Label>
              <Textarea
                id="notif-message"
                placeholder={t("notifMessagePlaceholder")}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                required
                data-testid="input-notif-message"
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !title.trim() || !message.trim()}
              data-testid="button-send-notification"
            >
              <Send className="w-4 h-4" />
              {loading ? t("sending") : t("sendNotif")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
