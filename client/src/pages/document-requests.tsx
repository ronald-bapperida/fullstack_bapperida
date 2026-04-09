// DocumentRequestsPage.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/contexts/language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileQuestion, Search, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import type { DocumentRequest } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DocumentRequestWithTitle extends DocumentRequest {
  documentTitle: string;
}

interface PagedResult {
  success: boolean;
  data: {
    items: DocumentRequestWithTitle[];
    total: number;
    page: number;
    totalPages: number;
  };
}

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("id-ID");
  } catch {
    return "-";
  }
};

export default function DocumentRequestsPage() {
  const { t } = useLang();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PagedResult>({
    queryKey: ["/api/admin/document-requests", page, search],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/document-requests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/document-requests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Berhasil", description: "Permohonan dokumen dihapus" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/document-requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
          <h1 className="text-xl font-bold">{t("docReqTitle") || "Permohonan Dokumen"}</h1>
          <p className="text-sm text-muted-foreground">{t("docReqSubtitle") || "Daftar permohonan dokumen dari pengguna"}</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder={t("searchPlaceholder") || "Cari berdasarkan nama, email, atau tujuan..."}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search-doc-requests"
              />
            </div>
            {data && (
              <span className="text-xs text-muted-foreground ml-auto">
                {t("totalData") || "Total"}: <b>{total}</b>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("noData") || "Tidak ada data"}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("name") || "Nama"}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("email") || "Email"}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("phone") || "No HP"}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("document") || "Dokumen"}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("purpose") || "Tujuan"}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("requestDate") || "Tanggal"}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("action") || "Aksi"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr
                      key={item.id}
                      className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      data-testid={`row-doc-request-${item.id}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium leading-tight">{item.name}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.email || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.phone || "–"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs line-clamp-2">{item.documentTitle}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="text-xs leading-relaxed line-clamp-2">{item.purpose}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Permohonan</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus permohonan dokumen dari <b>{item.name}</b>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                {t("page") || "Halaman"} {page} {t("of") || "dari"} {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  data-testid="button-next-page"
                >
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