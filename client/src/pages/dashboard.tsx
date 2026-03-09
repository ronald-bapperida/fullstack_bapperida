import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, ClipboardList, BarChart2, Image, FileText, Clock, CheckCircle, Trash2, TrendingUp, Download, MapPin, Users, PieChart } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfYear, endOfYear } from "date-fns";
import { id } from "date-fns/locale";

import {
  LineChart,
  Line,
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
  monthly: Array<{
    month: string;
    month_number?: number;
    year: number;
    total_views: number;
    top_news: Array<{
      id: string;
      title: string;
      views: number;
      slug: string;
    }>;
  }>;
  chart: Array<{
    month: string;
    views: number;
    topNews?: { title: string; views: number } | null;
  }>;
}

interface DocumentDownloadStats {
  monthly: Array<{
    month: string;
    month_number?: number;
    year: number;
    total_downloads: number;
    top_documents: Array<{
      id: string;
      title: string;
      downloads: number;
      fileUrl: string;
    }>;
  }>;
  chart: Array<{
    month: string;
    downloads: number;
    topDoc?: { title: string; downloads: number } | null;
  }>;
}

interface PermitOriginStats {
  institution: string;
  count: number;
  percentage: number;
}

interface SurveyStats {
  total_responses: number;
  satisfaction_rate: number;
  categories: Array<{
    category: string;
    value: number;
    percentage: number;
  }>;
  monthly_trend: Array<{
    month: string;
    responses: number;
    satisfaction: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4'];

function StatCard({ title, value, icon: Icon, sub, subLabel, trend, color = "text-primary" }: {
  title: string; 
  value: number; 
  icon: any; 
  sub?: number; 
  subLabel?: string;
  trend?: number;
  color?: string;
}) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
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
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span>{Math.abs(trend)}% dari bulan lalu</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MMMM", { locale: id }));

  // Generate tahun dari 2020 sampai sekarang
  const years = Array.from(
    { length: new Date().getFullYear() - 2019 }, 
    (_, i) => 2020 + i
  );

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({ 
    queryKey: ["/api/admin/dashboard"] 
  });

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

  const isBPP = user?.role === "super_admin" || user?.role === "admin_bpp";
  const isRIDA = user?.role === "super_admin" || user?.role === "admin_rida";

  // Data untuk chart views berita per bulan pilihan
  const selectedMonthNews = newsViews?.monthly?.find(m => m.month === selectedMonth);
  const newsViewsData = selectedMonthNews?.top_news?.map((item, index) => ({
    name: item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title,
    views: item.views,
    fill: COLORS[index % COLORS.length]
  })) || [];

  // Data untuk chart dokumen per bulan pilihan
  const selectedMonthDocs = documentDownloads?.monthly?.find(m => m.month === selectedMonth);
  const documentData = selectedMonthDocs?.top_documents?.map((item, index) => ({
    name: item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title,
    downloads: item.downloads,
    fill: COLORS[index % COLORS.length]
  })) || [];

  // Data untuk asal institusi
  const originData = permitOrigins?.map((item, index) => ({
    name: item.institution,
    value: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length]
  })) || [];

  // Data untuk survei kepuasan
  const satisfactionData = surveyStats?.categories || [];

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-background to-muted/20">
      {/* Header dengan gradient */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Selamat datang kembali, <span className="font-semibold text-foreground">{user?.fullName}</span>
          </p>
          <div className="flex gap-2 mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {user?.role?.replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <>
          {isBPP && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Newspaper className="w-4 h-4" /> BAPPEDA
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Total Berita"
                    value={stats.news}
                    icon={Newspaper}
                    sub={stats.publishedNews}
                    subLabel="dipublikasi"
                    color="text-blue-500"
                  />
                  <StatCard
                    title="Draft Berita"
                    value={stats.news - stats.publishedNews}
                    icon={Clock}
                    color="text-yellow-500"
                  />
                  <StatCard
                    title="Berita Trash"
                    value={stats.newsTrash}
                    icon={Trash2}
                    color="text-red-500"
                  />
                  <StatCard
                    title="Banner Aktif"
                    value={stats.banners}
                    icon={Image}
                    color="text-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Dokumen PPID"
                  value={stats.documents}
                  icon={FileText}
                  color="text-purple-500"
                />
              </div>
            </>
          )}

          {isRIDA && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> RIDA
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Izin Penelitian"
                  value={stats.permits}
                  icon={ClipboardList}
                  sub={stats.pendingPermits}
                  subLabel="menunggu review"
                  color="text-indigo-500"
                />
                <StatCard
                  title="Menunggu Review"
                  value={stats.pendingPermits}
                  icon={CheckCircle}
                  color="text-orange-500"
                />
                <StatCard
                  title="Survei IKM"
                  value={stats.surveys}
                  icon={BarChart2}
                  color="text-pink-500"
                />
                <StatCard
                  title="Rata-rata Kepuasan"
                  value={surveyStats?.satisfaction_rate || 0}
                  icon={TrendingUp}
                  subLabel="dari 100"
                  color="text-emerald-500"
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

      {/* Filter Tahun dan Bulan */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="news" className="space-y-4">
        <TabsList>
          <TabsTrigger value="news" disabled={!isBPP}>Berita & Dokumen</TabsTrigger>
          <TabsTrigger value="permits" disabled={!isRIDA}>Izin Penelitian</TabsTrigger>
          <TabsTrigger value="surveys" disabled={!isRIDA}>Survei Kepuasan</TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Views Berita */}
            {newsLoading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Berita dengan Views Terbanyak per Bulan
                  </CardTitle>
                  <CardDescription>
                    Tahun {selectedYear} • Total Views: {newsViews?.monthly?.reduce((acc: number, m: any) => acc + m.total_views, 0).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={newsViews?.chart || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const monthData = newsViews?.monthly?.find((m: any) => 
                                m.month.substring(0, 3) === label
                              );
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3">
                                  <p className="font-medium">{monthData?.month} {selectedYear}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Total Views: <span className="font-bold text-foreground">{payload[0].value?.toLocaleString()}</span>
                                  </p>
                                  {monthData?.top_news && monthData.top_news.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-xs font-medium mb-1">Top News:</p>
                                      {monthData.top_news.map((news: any, idx: number) => (
                                        <div key={idx} className="flex justify-between gap-4 text-xs">
                                          <span className="truncate max-w-[150px]">{news.title}</span>
                                          <span className="font-mono">{news.views} views</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="views" fill="#3b82f6">
                          {newsViews?.chart?.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Tabel detail per bulan */}
                  <div className="mt-6 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Bulan</th>
                          <th className="px-4 py-2 text-right">Total Views</th>
                          <th className="px-4 py-2 text-left">Berita Terpopuler</th>
                          <th className="px-4 py-2 text-right">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newsViews?.monthly?.map((month: any) => (
                          <tr key={month.month} className="border-t">
                            <td className="px-4 py-2 font-medium">{month.month}</td>
                            <td className="px-4 py-2 text-right">{month.total_views.toLocaleString()}</td>
                            <td className="px-4 py-2">
                              {month.top_news[0] ? (
                                <span className="truncate block max-w-[200px]" title={month.top_news[0].title}>
                                  {month.top_news[0].title}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {month.top_news[0]?.views.toLocaleString() || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart Downloads Dokumen */}
            {docsLoading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-purple-500" />
                    Dokumen Paling Banyak Diunduh per Bulan
                  </CardTitle>
                  <CardDescription>
                    Tahun {selectedYear} • Total Downloads: {documentDownloads?.monthly?.reduce((acc: number, m: any) => acc + m.total_downloads, 0).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={documentDownloads?.chart || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const monthData = documentDownloads?.monthly?.find((m: any) => 
                                m.month.substring(0, 3) === label
                              );
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3">
                                  <p className="font-medium">{monthData?.month} {selectedYear}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Total Downloads: <span className="font-bold text-foreground">{payload[0].value?.toLocaleString()}</span>
                                  </p>
                                  {monthData?.top_documents && monthData.top_documents.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-xs font-medium mb-1">Top Dokumen:</p>
                                      {monthData.top_documents.map((doc: any, idx: number) => (
                                        <div key={idx} className="flex justify-between gap-4 text-xs">
                                          <span className="truncate max-w-[150px]">{doc.title}</span>
                                          <span className="font-mono">{doc.downloads} downloads</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="downloads" fill="#8b5cf6">
                          {documentDownloads?.chart?.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Tabel detail per bulan */}
                  <div className="mt-6 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Bulan</th>
                          <th className="px-4 py-2 text-right">Total Downloads</th>
                          <th className="px-4 py-2 text-left">Dokumen Terpopuler</th>
                          <th className="px-4 py-2 text-right">Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentDownloads?.monthly?.map((month: any) => (
                          <tr key={month.month} className="border-t">
                            <td className="px-4 py-2 font-medium">{month.month}</td>
                            <td className="px-4 py-2 text-right">{month.total_downloads.toLocaleString()}</td>
                            <td className="px-4 py-2">
                              {month.top_documents[0] ? (
                                <span className="truncate block max-w-[200px]" title={month.top_documents[0].title}>
                                  {month.top_documents[0].title}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {month.top_documents[0]?.downloads.toLocaleString() || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="permits" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Asal Institusi */}
            {permitsLoading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-500" />
                    Asal Institusi Pemohon
                  </CardTitle>
                  <CardDescription>
                    Distribusi berdasarkan institusi • Tahun {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={originData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {originData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any, props: any) => [
                            `${value} pemohon (${props.payload.percentage}%)`,
                            'Jumlah'
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trend Izin Penelitian per Bulan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Trend Pengajuan Izin
                </CardTitle>
                <CardDescription>
                  Perbandingan bulanan • Tahun {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={months.map((month, index) => ({
                        name: month.substring(0, 3),
                        pengajuan: Math.floor(Math.random() * 30) + 5, // Simulasi data
                        disetujui: Math.floor(Math.random() * 25) + 3,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="pengajuan" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="disetujui" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Survei Kepuasan - Radar Chart */}
            {surveyLoading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-pink-500" />
                    Indeks Kepuasan Masyarakat
                  </CardTitle>
                  <CardDescription>
                    Berdasarkan kategori pelayanan • Tahun {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart outerRadius={90} data={satisfactionData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Kepuasan"
                          dataKey="value"
                          stroke="#ec4899"
                          fill="#ec4899"
                          fillOpacity={0.6}
                        />
                        <Tooltip 
                          formatter={(value: any) => [`${value}%`, 'Tingkat Kepuasan']}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trend Survei Bulanan */}
            {/* <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-cyan-500" />
                  Trend Survei Bulanan
                </CardTitle>
                <CardDescription>
                  Jumlah responden dan tingkat kepuasan • {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={months.map((month, index) => ({
                        month: month.substring(0, 3),
                        respondents: Math.floor(Math.random() * 50) + 10,
                        satisfaction: Math.floor(Math.random() * 30) + 70,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="respondents"
                        stroke="#06b6d4"
                        name="Responden"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="satisfaction"
                        stroke="#f97316"
                        name="Kepuasan (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card> */}
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Akun dengan desain lebih menarik */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-lg">{user?.fullName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">@{user?.username}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                  {user?.role === "super_admin" ? "Super Administrator" : 
                   user?.role === "admin_bpp" ? "Admin BAPPEDA" : 
                   user?.role === "admin_rida" ? "Admin RIDA" : "User"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}