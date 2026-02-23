import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ClipboardList, BarChart2, Image, FileText, Clock, CheckCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";

interface Stats {
  news: number;
  publishedNews: number;
  newsTrash: number;
  permits: number;
  pendingPermits: number;
  surveys: number;
  banners: number;
  documents: number;
}

function StatCard({ title, value, icon: Icon, sub, subLabel, color = "text-primary" }: {
  title: string; value: number; icon: any; sub?: number; subLabel?: string; color?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value.toLocaleString()}</div>
        {sub !== undefined && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-medium text-foreground">{sub}</span> {subLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<Stats>({ queryKey: ["/api/admin/dashboard"] });

  const isBPP = user?.role === "super_admin" || user?.role === "admin_bpp";
  const isRIDA = user?.role === "super_admin" || user?.role === "admin_rida";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Selamat datang, {user?.fullName}. Ini ringkasan sistem Portal BAPPERIDA.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <>
          {isBPP && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">BAPPEDA</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Total Berita"
                    value={stats.news}
                    icon={Newspaper}
                    sub={stats.publishedNews}
                    subLabel="dipublikasi"
                    color="text-chart-1"
                  />
                  <StatCard
                    title="Draft Berita"
                    value={stats.news - stats.publishedNews}
                    icon={Clock}
                    color="text-chart-3"
                  />
                  <StatCard
                    title="Berita Trash"
                    value={stats.newsTrash}
                    icon={Trash2}
                    color="text-muted-foreground"
                  />
                  <StatCard
                    title="Banner Aktif"
                    value={stats.banners}
                    icon={Image}
                    color="text-chart-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Dokumen PPID"
                  value={stats.documents}
                  icon={FileText}
                  color="text-chart-4"
                />
              </div>
            </>
          )}

          {isRIDA && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">RIDA</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Izin Penelitian"
                  value={stats.permits}
                  icon={ClipboardList}
                  sub={stats.pendingPermits}
                  subLabel="menunggu review"
                  color="text-primary"
                />
                <StatCard
                  title="Menunggu Review"
                  value={stats.pendingPermits}
                  icon={CheckCircle}
                  color="text-destructive"
                />
                <StatCard
                  title="Survei IKM"
                  value={stats.surveys}
                  icon={BarChart2}
                  color="text-chart-3"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Gagal memuat statistik</CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6">
          <div className="text-center">
            <p className="font-medium">Informasi Akun</p>
            <p className="text-sm text-muted-foreground mt-1">
              Anda login sebagai <span className="font-semibold text-foreground">{user?.username}</span> dengan
              role <span className="font-semibold text-foreground">{user?.role?.replace(/_/g, " ").toUpperCase()}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
