import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileQuestion, Search, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
import { apiRequest } from "@/lib/queryClient";

interface Requester {
  userId: string;
  name: string;
  email: string;
  phone: string;
  requestCount: number;
  latestAt: string | null;
}

interface PagedResult {
  success: boolean;
  data: { items: Requester[]; total: number; page: number; totalPages: number };
}

const formatDate = (v: string | null | undefined) => {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "-"; }
};

export default function DocumentRequestsPage() {
  const { t } = useLang();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PagedResult>({
    queryKey: ["/api/admin/document-requests/grouped", page, search],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/document-requests/grouped?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/document-requests/user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Berhasil", description: "Semua permohonan dokumen pemohon dihapus" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/document-requests/grouped"] });
    },
    onError: (e: any) => {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    },
  });

  const items = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
          <FileQuestion className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Permohonan Dokumen</h1>
          <p className="text-sm text-muted-foreground">Daftar pemohon yang mengunduh dokumen</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Cari nama, email, atau no HP..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search-doc-requests"
              />
            </div>
            {data && (
              <span className="text-xs text-muted-foreground ml-auto">
                Total: <b>{total}</b> pemohon
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Tidak ada data permohonan</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">No HP</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dokumen</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tanggal Pengajuan</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr
                      key={item.userId}
                      className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      data-testid={`row-requester-${item.userId}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{item.name}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.email || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.phone || "–"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {item.requestCount} dokumen
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(item.latestAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/document-requests/${item.userId}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              data-testid={`button-detail-${item.userId}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                                data-testid={`button-delete-${item.userId}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Semua Permohonan</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus semua <b>{item.requestCount} permohonan dokumen</b> dari <b>{item.name}</b>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(item.userId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Hapus Semua
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground text-xs">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
