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
import { Bell, Send, Smartphone, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function PushNotificationPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

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
    mutationFn: () => apiRequest("POST", "/api/admin/push-notification", { title, body, targetRole: "user" }),
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
          <p className="text-sm text-muted-foreground">Kirim push notification via Firebase Cloud Messaging ke pengguna mobile</p>
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
                    Tambahkan variabel environment Firebase ke Secrets, lalu restart aplikasi.
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
            Kirim Push Notification ke Pengguna
          </CardTitle>
          <CardDescription>
            Notifikasi dikirim ke semua pengguna mobile (Flutter app) yang sudah login dan mendaftarkan perangkatnya
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }}
            className="space-y-4"
          >
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
              {sendMutation.isPending ? "Mengirim..." : "Kirim ke Semua Pengguna"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
