import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLang } from "@/contexts/language";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Users, Smartphone, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function PushNotificationPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <h2 className="text-xl font-bold">{t("accessDenied")}</h2>
        <p className="text-muted-foreground">{t("accessDeniedDesc")}</p>
      </div>
    );
  }

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

      <Tabs defaultValue="inapp">
        <TabsList className="w-full">
          <TabsTrigger value="inapp" className="flex-1 gap-2">
            <Bell className="w-3.5 h-3.5" />
            {t("inAppNotif")}
          </TabsTrigger>
          <TabsTrigger value="fcm" className="flex-1 gap-2">
            <Smartphone className="w-3.5 h-3.5" />
            FCM Push Notification
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inapp" className="mt-4">
          <InAppNotifCard />
        </TabsContent>

        <TabsContent value="fcm" className="mt-4">
          <FcmPushCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InAppNotifCard() {
  const { t } = useLang();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/notifications/broadcast", { title, message }),
    onSuccess: () => {
      toast({ title: t("notifSent"), description: t("notifSentDesc") });
      setTitle("");
      setMessage("");
    },
    onError: (err: any) => {
      toast({ title: t("errorSaveData"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-muted-foreground" />
          {t("notifTargetAll")}
        </CardTitle>
        <CardDescription>{t("notifTargetAllDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }}
          className="space-y-4"
        >
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
            disabled={sendMutation.isPending || !title.trim() || !message.trim()}
            data-testid="button-send-notification"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendMutation.isPending ? t("sending") : t("sendNotif")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FcmPushCard() {
  const { t } = useLang();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState("all");

  const { data: status } = useQuery<{ available: boolean; configured: boolean }>({
    queryKey: ["/api/admin/push-notification/status"],
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/push-notification", { title, body, targetRole }),
    onSuccess: (data: any) => {
      toast({ title: "Push notification terkirim", description: data?.message || `Terkirim ke ${data?.sent ?? 0} perangkat` });
      setTitle("");
      setBody("");
    },
    onError: (err: any) => {
      toast({ title: "Gagal kirim push", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          Firebase Push Notification
        </CardTitle>
        <CardDescription>
          Kirim push notification ke browser admin atau perangkat mobile yang sudah mendaftarkan token FCM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Firebase status badge */}
        {status && (
          <div className="flex items-center gap-2 text-sm">
            {status.available ? (
              <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-600 dark:text-green-400">Firebase terhubung</span></>
            ) : (
              <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">Firebase belum dikonfigurasi — tambahkan <code className="text-xs bg-muted px-1 rounded">FIREBASE_SERVICE_ACCOUNT</code> di Secrets</span></>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Target Penerima</Label>
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger data-testid="select-fcm-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin_bpp">Admin BAPPEDA</SelectItem>
                <SelectItem value="admin_rida">Admin RIDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fcm-title">Judul Notifikasi</Label>
            <Input
              id="fcm-title"
              placeholder="Judul push notification"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              data-testid="input-fcm-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fcm-body">Isi Pesan</Label>
            <Textarea
              id="fcm-body"
              placeholder="Isi push notification"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              required
              data-testid="input-fcm-body"
            />
          </div>
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={sendMutation.isPending || !title.trim() || !body.trim() || !status?.available}
            data-testid="button-send-fcm"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendMutation.isPending ? "Mengirim..." : "Kirim Push Notification"}
          </Button>
        </form>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Cara setup FCM:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Buat project di <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline">Firebase Console</a></li>
            <li>Aktifkan Cloud Messaging → tambahkan Web App</li>
            <li>Salin config ke Secrets: <code className="bg-muted px-1 rounded">VITE_FIREBASE_API_KEY</code>, <code className="bg-muted px-1 rounded">VITE_FIREBASE_PROJECT_ID</code>, dll.</li>
            <li>Download Service Account JSON → set ke <code className="bg-muted px-1 rounded">FIREBASE_SERVICE_ACCOUNT</code></li>
            <li>Generate VAPID key → set ke <code className="bg-muted px-1 rounded">VITE_FIREBASE_VAPID_KEY</code></li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
