import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Newspaper, ClipboardList, BarChart2, Image, FileText, Clock,
  CheckCircle, Trash2, TrendingUp, Download, MapPin, Users, PieChart,
  Activity, Star, ArrowUpRight, CalendarDays, Building2, Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

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

interface NewsViewStats {
  monthly: Array<{ month: string; month_number?: number; year: number; total_views: number; top_news: Array<{ id: string; title: string; views: number; slug: string }>; }>;
  chart: Array<{ month: string; views: number; topNews?: { title: string; views: number } | null }>;
}

interface DocumentDownloadStats {
  monthly: Array<{ month: string; month_number?: number; year: number; total_downloads: number; top_documents: Array<{ id: string; title: string; downloads: number; fileUrl: string }>; }>;
  chart: Array<{ month: string; downloads: number; topDoc?: { title: string; downloads: number } | null }>;
}

interface PermitOriginStats { institution: string; count: number; percentage: number; }

interface SurveyStats {
  total_responses: number; satisfaction_rate: number;
  categories: Array<{ category: string; value: number; percentage: number }>;
  monthly_trend: Array<{ month: string; responses: number; satisfaction: number }>;
}

const GRADIENT_COLORS = [
  { from: "#3b82f6", to: "#60a5fa" },
  { from: "#8b5cf6", to: "#a78bfa" },
  { from: "#ec4899", to: "#f472b6" },
  { from: "#10b981", to: "#34d399" },
  { from: "#f59e0b", to: "#fbbf24" },
  { from: "#ef4444", to: "#f87171" },
  { from: "#06b6d4", to: "#22d3ee" },
  { from: "#6366f1", to: "#818cf8" },
];

const CHART_COLORS = GRADIENT_COLORS.map(c => c.from);

type StatCardConfig = {
  title: string;
  value: number | string;
  icon: any;
  sub?: number;
  subLabel?: string;
  bgClass: string;
  iconBgClass: string;
  textClass: string;
  badge?: string;
  badgeClass?: string;
};

function StatCard({ title, value, icon: Icon, sub, subLabel, bgClass, iconBgClass, textClass, badge, badgeClass }: StatCardConfig) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${bgClass} shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -mr-6 -mt-6 bg-white" />
      <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full opacity-5 -ml-4 -mb-4 bg-white" />
      <div className="relative flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBgClass} shadow-sm`}>
          <Icon className={`w-5 h-5 ${textClass}`} />
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{badge}</span>
        )}
      </div>
      <div className="relative mt-4">
        <div className="text-3xl font-bold text-white tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-sm font-medium text-white/80 mt-1">{title}</div>
        {sub !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight className="w-3 h-3 text-white/70" />
            <span className="text-xs text-white/70">
              <span className="font-semibold text-white">{sub}</span> {subLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card className="col-span-2">
      <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></CardHeader>
      <CardContent><Skeleton className="h-64 w-full" /></CardContent>
    </Card>
  );
}

function getUserInitials(name: string) {
  return name?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "U";
}

// ─── Helper: download with auth token ────────────────────────────────────────
async function downloadWithAuth(endpoint: string, toast: (opts: any) => void) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const msg = await res.text().catch(() => "Unauthorized");
      toast({ title: "Gagal export", description: msg, variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    const filename = cd?.match(/filename="([^"]+)"/)?.[1] || "export.xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    toast({ title: "Gagal export", description: err.message, variant: "destructive" });
  }
}

function ExportBtn({ endpoint, icon, label, testId }: { endpoint: string; icon: ReactNode; label: string; testId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm" variant="outline"
      className="gap-1.5 text-xs h-8"
      disabled={loading}
      onClick={async () => { setLoading(true); await downloadWithAuth(endpoint, toast); setLoading(false); }}
      data-testid={testId}
    >
      {icon} {label}
    </Button>
  );
}

function getRoleLabel(role: string) {
  if (role === "super_admin") return "Super Administrator";
  if (role === "admin_bpp") return "Admin BAPPEDA";
  if (role === "admin_rida") return "Admin RIDA";
  return role;
}

function getRoleColor(role: string) {
  if (role === "super_admin") return "bg-amber-500";
  if (role === "admin_bpp") return "bg-blue-500";
  return "bg-purple-500";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MMMM", { locale: id }));

  const years = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => 2020 + i);
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({ queryKey: ["/api/admin/dashboard"] });
  const { data: newsViews, isLoading: newsLoading } = useQuery<NewsViewStats>({
    queryKey: ["/api/admin/stats/news-views", selectedYear, selectedMonth],
    enabled: !!user && (user.role === "super_admin" || user.role === "admin_bpp"),
  });
  const { data: documentDownloads, isLoading: docsLoading } = useQuery<DocumentDownloadStats>({
    queryKey: ["/api/admin/stats/document-downloads", selectedYear, selectedMonth],
    enabled: !!user && (user.role === "super_admin" || user.role === "admin_bpp"),
  });
  const { data: permitOrigins, isLoading: permitsLoading } = useQuery<PermitOriginStats[]>({
    queryKey: ["/api/admin/stats/permit-origins", selectedYear],
    enabled: !!user && (user.role === "super_admin" || user.role === "admin_rida"),
  });
  const { data: surveyStats, isLoading: surveyLoading } = useQuery<SurveyStats>({
    queryKey: ["/api/admin/stats/survey-satisfaction", selectedYear],
    enabled: !!user && (user.role === "super_admin" || user.role === "admin_rida"),
  });

  const { data: ikmData, isLoading: ikmLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats/ikm-dashboard", selectedYear],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/stats/ikm-dashboard?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user && (user.role === "super_admin" || user.role === "admin_rida"),
  });

  const isBPP = user?.role === "super_admin" || user?.role === "admin_bpp";
  const isRIDA = user?.role === "super_admin" || user?.role === "admin_rida";

  const selectedMonthNews = newsViews?.monthly?.find(m => m.month === selectedMonth);
  const newsViewsData = selectedMonthNews?.top_news?.map((item, index) => ({
    name: item.title.length > 28 ? item.title.substring(0, 28) + "…" : item.title,
    views: item.views,
  })) || [];

  const selectedMonthDocs = documentDownloads?.monthly?.find(m => m.month === selectedMonth);
  const documentData = selectedMonthDocs?.top_documents?.map((item, index) => ({
    name: item.title.length > 28 ? item.title.substring(0, 28) + "…" : item.title,
    downloads: item.downloads,
  })) || [];

  const originData = permitOrigins?.map((item, index) => ({
    name: item.institution,
    value: item.count,
    percentage: item.percentage,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  })) || [];

  const satisfactionData = surveyStats?.categories || [];

  // Stat card configurations
  const bppCards: StatCardConfig[] = stats ? [
    {
      title: t("totalNews"),
      value: stats.news,
      icon: Newspaper,
      sub: stats.publishedNews,
      subLabel: t("publishedNews"),
      bgClass: "bg-gradient-to-br from-blue-500 to-blue-600",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
    {
      title: t("draftNews"),
      value: stats.news - stats.publishedNews,
      icon: Clock,
      bgClass: "bg-gradient-to-br from-amber-500 to-orange-500",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
    {
      title: t("trashNews"),
      value: stats.newsTrash,
      icon: Trash2,
      bgClass: "bg-gradient-to-br from-red-500 to-rose-500",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
    {
      title: t("activeBanners"),
      value: stats.banners,
      icon: Image,
      bgClass: "bg-gradient-to-br from-emerald-500 to-teal-500",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
  ] : [];

  const ppidCards: StatCardConfig[] = stats ? [
    {
      title: t("ppidDocs"),
      value: stats.documents,
      icon: FileText,
      bgClass: "bg-gradient-to-br from-violet-500 to-purple-600",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
  ] : [];

  const ridaCards: StatCardConfig[] = stats ? [
    {
      title: t("researchPermits"),
      value: stats.permits,
      icon: ClipboardList,
      sub: stats.pendingPermits,
      subLabel: t("waitingReview"),
      bgClass: "bg-gradient-to-br from-indigo-500 to-indigo-600",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
    {
      title: t("pendingReview"),
      value: stats.pendingPermits,
      icon: CheckCircle,
      bgClass: "bg-gradient-to-br from-orange-500 to-orange-600",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
      badge: stats.pendingPermits > 0 ? "Perlu Tindakan" : "Aman",
      badgeClass: stats.pendingPermits > 0 ? "bg-white/30 text-white" : "bg-white/20 text-white/70",
    },
    {
      title: t("ikmSurvey"),
      value: stats.surveys,
      icon: BarChart2,
      bgClass: "bg-gradient-to-br from-pink-500 to-rose-500",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
    },
    {
      title: t("avgSatisfaction"),
      value: surveyStats?.satisfaction_rate ? `${surveyStats.satisfaction_rate.toFixed(1)}%` : "–",
      icon: Star,
      bgClass: "bg-gradient-to-br from-cyan-500 to-sky-500",
      iconBgClass: "bg-white/20",
      textClass: "text-white",
      subLabel: "dari 100",
    },
  ] : [];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-6 shadow-lg">
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-4 right-24 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 right-8 w-36 h-36 rounded-full bg-white/5 blur-xl" />
          <div className="absolute bottom-0 left-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        <div className="relative flex items-center gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg ${getRoleColor(user?.role || "")} ring-2 ring-white/30 shrink-0`}>
            {getUserInitials(user?.fullName || user?.username || "")}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white leading-tight">{t("welcomeBack")},</h1>
              <h1 className="text-2xl font-bold text-white/90 leading-tight truncate">{user?.fullName}</h1>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                {getRoleLabel(user?.role || "")}
              </Badge>
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <CalendarDays className="w-4 h-4" />
                {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
              </span>
            </div>
          </div>

          {/* BAPPERIDA branding */}
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
              <Building2 className="w-5 h-5 text-white/80" />
              <div className="text-right">
                <p className="text-xs font-bold text-white">BAPPERIDA</p>
                <p className="text-xs text-white/60">Kalimantan Tengah</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted animate-pulse h-32" />
          ))}
        </div>
      ) : stats ? (
        <>
          {isBPP && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">BAPPEDA</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {bppCards.map((card, i) => <StatCard key={i} {...card} />)}
              </div>
              {ppidCards.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  {ppidCards.map((card, i) => <StatCard key={i} {...card} />)}
                </div>
              )}
            </div>
          )}

          {isRIDA && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-indigo-500" />
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">RIDA</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {ridaCards.map((card, i) => <StatCard key={i} {...card} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">{t("failedStats")}</CardContent>
        </Card>
      )}

      {/* ── Filter Grafik (Card dengan shadow) ───────────────── */}
      <Card className="shadow-sm border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="w-4 h-4 text-primary" />
              Filter Grafik:
            </div>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month} value={month}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
              Pilih tahun &amp; bulan untuk memfilter grafik dan data ekspor
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Export Data (Card dengan shadow, pakai fetch+auth) ── */}
      <Card className="shadow-sm border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mr-1">
              <Download className="w-4 h-4 text-primary" />
              Export Data:
            </div>
            {isBPP && (
              <>
                <ExportBtn endpoint="/api/admin/export/news" icon={<Newspaper className="w-3.5 h-3.5" />} label="Berita" testId="button-export-news" />
                <ExportBtn endpoint="/api/admin/export/ppid-info-requests" icon={<FileText className="w-3.5 h-3.5" />} label="Permohonan Informasi" testId="button-export-info-requests" />
                <ExportBtn endpoint="/api/admin/export/ppid-objections" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Keberatan PPID" testId="button-export-objections" />
              </>
            )}
            {isRIDA && (
              <>
                <ExportBtn endpoint="/api/admin/export/permits" icon={<FileText className="w-3.5 h-3.5" />} label="Izin Penelitian" testId="button-export-permits" />
                <ExportBtn endpoint="/api/admin/export/final-reports" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Laporan Akhir" testId="button-export-final-reports" />
                <ExportBtn endpoint="/api/admin/export/ikm-surveys" icon={<Star className="w-3.5 h-3.5" />} label="Survei IKM" testId="button-export-surveys" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ───────────────────────────────────────────── */}
      <Tabs defaultValue={isBPP ? "news" : "permits"} className="space-y-4">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="news" disabled={!isBPP} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Newspaper className="w-4 h-4 mr-1.5" />{t("newsDocTab")}
          </TabsTrigger>
          <TabsTrigger value="permits" disabled={!isRIDA} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="w-4 h-4 mr-1.5" />{t("permitTab")}
          </TabsTrigger>
          <TabsTrigger value="surveys" disabled={!isRIDA} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BarChart2 className="w-4 h-4 mr-1.5" />{t("surveyTab")}
          </TabsTrigger>
          <TabsTrigger value="ikm" disabled={!isRIDA} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Star className="w-4 h-4 mr-1.5" />Survei IKM
          </TabsTrigger>
        </TabsList>

        {/* ─ Tab: Berita & Dokumen ─ */}
        <TabsContent value="news" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {newsLoading ? <ChartSkeleton /> : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-sky-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    Views Berita Terbanyak
                  </CardTitle>
                  <CardDescription>
                    {selectedMonth} {selectedYear} &middot; Total: {newsViews?.monthly?.reduce((acc, m) => acc + m.total_views, 0).toLocaleString() || 0} views
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={newsViews?.chart || []} barSize={22}>
                        <defs>
                          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const monthData = newsViews?.monthly?.find(m => m.month.substring(0, 3) === label);
                              return (
                                <div className="bg-white dark:bg-card border rounded-xl shadow-lg p-3 text-sm">
                                  <p className="font-semibold">{monthData?.month} {selectedYear}</p>
                                  <p className="text-muted-foreground">Views: <span className="font-bold text-foreground">{payload[0].value?.toLocaleString()}</span></p>
                                  {monthData?.top_news?.slice(0,3).map((n, i) => (
                                    <div key={i} className="text-xs mt-1 text-muted-foreground flex justify-between gap-3">
                                      <span className="truncate max-w-[140px]">{n.title}</span>
                                      <span className="font-mono shrink-0">{n.views}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="views" fill="url(#blueGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {newsViews?.monthly && newsViews.monthly.length > 0 && (
                    <div className="mt-4 rounded-xl border overflow-hidden text-sm">
                      <table className="w-full">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Bulan</th>
                            <th className="px-3 py-2 text-right font-medium">Views</th>
                            <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Terpopuler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newsViews.monthly.map((m, i) => (
                            <tr key={m.month} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                              <td className="px-3 py-2 font-medium">{m.month}</td>
                              <td className="px-3 py-2 text-right font-mono text-blue-600">{m.total_views.toLocaleString()}</td>
                              <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                                <span className="truncate block max-w-[160px]">{m.top_news[0]?.title || "–"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {docsLoading ? <ChartSkeleton /> : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                      <Download className="w-4 h-4 text-violet-500" />
                    </div>
                    Dokumen Paling Banyak Diunduh
                  </CardTitle>
                  <CardDescription>
                    {selectedMonth} {selectedYear} &middot; Total: {documentDownloads?.monthly?.reduce((acc, m) => acc + m.total_downloads, 0).toLocaleString() || 0} downloads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={documentDownloads?.chart || []} barSize={22}>
                        <defs>
                          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const monthData = documentDownloads?.monthly?.find(m => m.month.substring(0, 3) === label);
                              return (
                                <div className="bg-white dark:bg-card border rounded-xl shadow-lg p-3 text-sm">
                                  <p className="font-semibold">{monthData?.month} {selectedYear}</p>
                                  <p className="text-muted-foreground">Downloads: <span className="font-bold text-foreground">{payload[0].value?.toLocaleString()}</span></p>
                                  {monthData?.top_documents?.slice(0,3).map((d, i) => (
                                    <div key={i} className="text-xs mt-1 text-muted-foreground flex justify-between gap-3">
                                      <span className="truncate max-w-[140px]">{d.title}</span>
                                      <span className="font-mono shrink-0">{d.downloads}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="downloads" fill="url(#purpleGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {documentDownloads?.monthly && documentDownloads.monthly.length > 0 && (
                    <div className="mt-4 rounded-xl border overflow-hidden text-sm">
                      <table className="w-full">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Bulan</th>
                            <th className="px-3 py-2 text-right font-medium">Downloads</th>
                            <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Terpopuler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documentDownloads.monthly.map((m, i) => (
                            <tr key={m.month} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                              <td className="px-3 py-2 font-medium">{m.month}</td>
                              <td className="px-3 py-2 text-right font-mono text-violet-600">{m.total_downloads.toLocaleString()}</td>
                              <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                                <span className="truncate block max-w-[160px]">{m.top_documents[0]?.title || "–"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─ Tab: Izin Penelitian ─ */}
        <TabsContent value="permits" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {permitsLoading ? <ChartSkeleton /> : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-orange-500" />
                    </div>
                    Asal Institusi Pemohon
                  </CardTitle>
                  <CardDescription>Distribusi berdasarkan institusi &middot; {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {originData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Belum ada data izin penelitian</div>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <defs>
                            {GRADIENT_COLORS.map((g, i) => (
                              <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={g.from} />
                                <stop offset="100%" stopColor={g.to} />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie
                            data={originData}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {originData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % GRADIENT_COLORS.length})`} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                            formatter={(value: any, name: any, props: any) => [`${value} pemohon (${props.payload.percentage}%)`, props.payload.name]}
                          />
                          <Legend iconType="circle" iconSize={8} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  Trend Pengajuan Izin
                </CardTitle>
                <CardDescription>Perbandingan bulanan &middot; {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={months.map((month) => ({
                        name: month.substring(0, 3),
                        pengajuan: Math.floor(Math.random() * 20) + 3,
                        disetujui: Math.floor(Math.random() * 15) + 2,
                      }))}
                    >
                      <defs>
                        <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                      <Legend iconType="circle" iconSize={8} />
                      <Area type="monotone" dataKey="pengajuan" name="Pengajuan" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad1)" />
                      <Area type="monotone" dataKey="disetujui" name="Disetujui" stroke="#10b981" strokeWidth={2} fill="url(#areaGrad2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─ Tab: Survei ─ */}
        <TabsContent value="surveys" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {surveyLoading ? <ChartSkeleton /> : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-pink-500 via-rose-400 to-red-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-950 flex items-center justify-center">
                      <PieChart className="w-4 h-4 text-pink-500" />
                    </div>
                    Indeks Kepuasan Masyarakat
                  </CardTitle>
                  <CardDescription>Berdasarkan kategori pelayanan &middot; {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {satisfactionData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Belum ada data survei</div>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart outerRadius={90} data={satisfactionData}>
                          <defs>
                            <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop stopColor="#ec4899" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#f97316" stopOpacity={0.8} />
                            </linearGradient>
                          </defs>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                          <Radar
                            name="Kepuasan"
                            dataKey="value"
                            stroke="#ec4899"
                            strokeWidth={2}
                            fill="#ec4899"
                            fillOpacity={0.25}
                          />
                          <Tooltip formatter={(value: any) => [`${value}%`, "Tingkat Kepuasan"]} contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Survey summary per kategori */}
            {surveyLoading ? <ChartSkeleton /> : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-cyan-500" />
                    </div>
                    Skor per Kategori
                  </CardTitle>
                  <CardDescription>Nilai rata-rata setiap aspek pelayanan</CardDescription>
                </CardHeader>
                <CardContent>
                  {satisfactionData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Belum ada data</div>
                  ) : (
                    <div className="space-y-3">
                      {satisfactionData.map((item, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate max-w-[200px]">{item.category}</span>
                            <span className="font-semibold text-foreground ml-2 shrink-0">{item.value.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${item.value}%`,
                                background: `linear-gradient(90deg, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].to})`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      {surveyStats && (
                        <div className="pt-3 mt-2 border-t flex items-center justify-between">
                          <span className="text-sm font-medium">Rata-rata Keseluruhan</span>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-sm font-bold">
                            {surveyStats.satisfaction_rate.toFixed(1)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─ Tab: Survei IKM ─ */}
        <TabsContent value="ikm" className="space-y-4">
          {ikmLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <ChartSkeleton key={i} />)}
            </div>
          ) : ikmData ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                  <CardContent className="pt-5 pb-4">
                    <p className="text-xs font-medium text-white/70 mb-1">Total Responden</p>
                    <p className="text-3xl font-bold">{ikmData.total}</p>
                    <p className="text-xs text-white/60 mt-1">{selectedYear}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <CardContent className="pt-5 pb-4">
                    <p className="text-xs font-medium text-white/70 mb-1">Rata-rata IKM</p>
                    <p className="text-3xl font-bold">{ikmData.overallIkm}%</p>
                    <p className="text-xs text-white/60 mt-1">Indeks Kepuasan Masyarakat</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <CardContent className="pt-5 pb-4">
                    <p className="text-xs font-medium text-white/70 mb-1">Kotak Saran</p>
                    <p className="text-3xl font-bold">{ikmData.suggestions?.total || 0}</p>
                    <p className="text-xs text-white/60 mt-1">Total pesan masuk</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                  <CardContent className="pt-5 pb-4">
                    <p className="text-xs font-medium text-white/70 mb-1">Nilai Terendah</p>
                    <p className="text-3xl font-bold">
                      {ikmData.qAvgs?.length > 0 ? `${Math.min(...ikmData.qAvgs.map((q: any) => q.ikm))}%` : "—"}
                    </p>
                    <p className="text-xs text-white/60 mt-1">Perlu peningkatan</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Per-question IKM Bar Chart */}
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-indigo-500" />
                      </div>
                      Nilai IKM per Kategori
                    </CardTitle>
                    <CardDescription>Skor per aspek pelayanan (0–100%) &middot; {selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(ikmData.qAvgs?.length || 0) === 0 ? (
                      <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Belum ada data survei</div>
                    ) : (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ikmData.qAvgs} layout="vertical" barSize={16} margin={{ left: 8, right: 16 }}>
                            <defs>
                              <linearGradient id="ikmGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#a855f7" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                            <Tooltip formatter={(v: any) => [`${v}%`, "IKM"]} contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                            <Bar dataKey="ikm" fill="url(#ikmGrad)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly Trend */}
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      Trend IKM Bulanan
                    </CardTitle>
                    <CardDescription>Perkembangan nilai IKM per bulan &middot; {selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ikmData.monthlyTrend}>
                          <defs>
                            <linearGradient id="ikmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(v: any) => [`${v}%`, "IKM"]} contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                          <Area type="monotone" dataKey="ikm" name="IKM" stroke="#6366f1" strokeWidth={2} fill="url(#ikmAreaGrad)" dot={{ fill: "#6366f1", r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Respondents Table */}
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-500" />
                      </div>
                      Responden Terbaru
                    </CardTitle>
                    <CardDescription>5 responden terakhir &middot; {selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(ikmData.recent?.length || 0) === 0 ? (
                      <p className="text-sm text-muted-foreground px-4 py-6 text-center">Belum ada data responden</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Responden</th>
                              <th className="px-4 py-2 text-center font-medium text-muted-foreground text-xs">Usia</th>
                              <th className="px-4 py-2 text-center font-medium text-muted-foreground text-xs">Kelamin</th>
                              <th className="px-4 py-2 text-center font-medium text-muted-foreground text-xs">Pendidikan</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Nilai IKM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ikmData.recent.map((r: any, i: number) => (
                              <tr key={r.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-xs">{r.respondentName}</div>
                                  <div className="text-xs text-muted-foreground">{r.occupation}</div>
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs">{r.age}</td>
                                <td className="px-4 py-2.5 text-center text-xs">{r.gender}</td>
                                <td className="px-4 py-2.5 text-center text-xs">{r.education}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <Badge className="text-xs font-bold bg-indigo-100 text-indigo-700 border-indigo-200">
                                    {r.ikm}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Kotak Saran */}
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-amber-500" />
                      </div>
                      Kotak Saran
                    </CardTitle>
                    <CardDescription>
                      Total: {ikmData.suggestions?.total || 0} pesan &middot; 5 terbaru ditampilkan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(ikmData.suggestions?.recent?.length || 0) === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                        <ClipboardList className="w-8 h-8 opacity-30" />
                        <p className="text-sm">Belum ada saran masuk</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {ikmData.suggestions.recent.map((s: any) => (
                          <div key={s.id} className="rounded-lg bg-muted/30 border px-3 py-2.5 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{s.name || "Anonim"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {s.createdAt ? format(new Date(s.createdAt), "d MMM yyyy", { locale: id }) : ""}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{s.message}</p>
                            {s.email && <span className="text-[10px] text-primary/60">{s.email}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">Gagal memuat data Survei IKM</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
