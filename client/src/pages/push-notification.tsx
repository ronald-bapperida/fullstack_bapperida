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
import { Bell, Send, Smartphone, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function PushNotificationPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState("all");

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <h2 className="text-xl font-bold">{t("accessDenied")}</h2>
        <p className="text-muted-foreground">{t("accessDeniedDesc")}</p>
      </div>
    );
  }

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
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("pushNotifTitle")}</h1>
          <p className="text-sm text-muted-foreground">Kirim push notification via Firebase Cloud Messaging ke admin dan pengguna mobile</p>
        </div>
      </div>

      {/* Firebase status */}
      <Card className={`border ${status?.available ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            {status?.available
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              {status?.available ? (
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Firebase Cloud Messaging aktif dan siap digunakan</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Firebase belum dikonfigurasi</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tambahkan variabel environment Firebase ke Secrets Replit, lalu restart aplikasi.
                    Lihat file <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">.env.example</code> di project untuk panduan lengkap.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send push notification form */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            Kirim Push Notification
          </CardTitle>
          <CardDescription>
            Push dikirim ke semua perangkat yang sudah mendaftarkan FCM token (browser admin + mobile app)
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                placeholder="Contoh: Pengumuman Penting"
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
                placeholder="Tulis isi push notification di sini..."
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
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card className="border-0 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Panduan Setup Firebase</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-3">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Buka <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a> → buat project baru</li>
            <li>Klik <strong>Project Settings</strong> → <strong>General</strong> → scroll ke <strong>Your apps</strong> → klik <strong>Web</strong> → salin config</li>
            <li>Klik tab <strong>Cloud Messaging</strong> → Generate <strong>VAPID key pair</strong> → salin Public key</li>
            <li>Klik tab <strong>Service accounts</strong> → <strong>Generate new private key</strong> → download JSON</li>
            <li>Buka <strong>Replit Secrets</strong> dan tambahkan semua variabel dari file <code className="bg-muted px-1 rounded">.env.example</code></li>
            <li>Restart aplikasi — Firebase siap digunakan</li>
          </ol>
          <p className="text-xs mt-2">
            Untuk Flutter: panggil <code className="bg-muted px-1 rounded">POST /api/v1/fcm/token</code> setelah login dengan body <code className="bg-muted px-1 rounded">{`{"token":"<fcm_token>","device_type":"android"}`}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
