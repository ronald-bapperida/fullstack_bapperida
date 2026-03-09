import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Edit, Eye, RefreshCw, Newspaper, Globe, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface News {
  id: string; title: string; slug: string; status: string;
  publishedAt: string | null; createdAt: string; viewCount: number;
  categoryId: string | null; deletedAt: string | null;
}

export default function NewsPage() {
  const { toast } = useToast();
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [trash, setTrash] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "publishedAt" | "createdAt">("publishedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const params = {
    page: String(page), limit: "15",
    sortBy, sortDir,
    ...(search ? { search } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(trash ? { trash: "true" } : {}),
  };
  const { data, isLoading } = useQuery<{ items: News[]; total: number }>({ queryKey: ["/api/admin/news", params] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/news/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] }); toast({ title: "Berita dipindahkan ke trash" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/news/${id}/restore`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] }); toast({ title: "Berita berhasil dipulihkan" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/news/${id}/toggle-status`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<News>;
    },
    onSuccess: (data: News) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({ title: data.status === "published" ? "Berita dipublikasikan" : "Berita dikembalikan ke draft" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  function toggleSort(key: "title" | "publishedAt") {
    setPage(1);
    setSortBy(prev => {
      if (prev !== key) {
        setSortDir(key === "title" ? "asc" : "desc");
        return key;
      }
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  function SortableHead({
    label,
    colKey,
    sortBy,
    sortDir,
    onSort,
    className,
  }: {
    label: React.ReactNode;
    colKey: "title" | "publishedAt";
    sortBy: string;
    sortDir: "asc" | "desc";
    onSort: (key: "title" | "publishedAt") => void;
    className?: string;
  }) {
    const active = sortBy === colKey;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => onSort(colKey)}
          className="inline-flex items-center gap-2 select-none hover:text-foreground"
        >
          <span>{label}</span>
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </TableHead>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6" /> {t("news")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{total} {t("totalData")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={trash ? "default" : "outline"}
            size="sm"
            onClick={() => { setTrash(!trash); setPage(1); }}
            data-testid="button-toggle-trash"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {trash ? t("back") : t("trash")}
          </Button>
          {!trash && (
            <Link href="/news/create">
              <Button size="sm" className="gap-2" data-testid="button-create-news">
                <Plus className="w-4 h-4" />
                {t("addNews")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-search-news"
          />
        </div>
        {!trash && (
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-44" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="published">{t("published")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label={t("tableColTitle")}
                colKey="title"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              {/* <TableHead>{t("tableColTitle")}</TableHead> */}
              <TableHead className="w-36">{t("tableColStatus")}</TableHead>
              {/* <TableHead className="w-36">{t("tableColDate")}</TableHead> */}
              <SortableHead
                label={t("tableColDate")}
                colKey="publishedAt"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-36"
              />
              <TableHead className="w-20 text-right">Views</TableHead>
              <TableHead className="w-28 text-right">{t("tableColAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {trash ? "Tidak ada berita di trash" : "Belum ada berita"}
                </TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.id} data-testid={`row-news-${item.id}`}>
                <TableCell>
                  <div className="font-medium line-clamp-1">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">/{item.slug}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.status === "published" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {item.status === "published" ? "Published" : "Draft"}
                    </Badge>
                    {!trash && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => toggleStatusMutation.mutate(item.id)}
                        disabled={toggleStatusMutation.isPending}
                        data-testid={`button-toggle-status-${item.id}`}
                        title={item.status === "published" ? "Tarik ke draft" : "Publikasikan"}
                      >
                        {item.status === "published"
                          ? <><FileText className="w-3 h-3 mr-1" />Draft</>
                          : <><Globe className="w-3 h-3 mr-1" />Publish</>
                        }
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(item.publishedAt || item.createdAt), "d MMM yyyy HH:mm", { locale: id })}
                </TableCell>
                <TableCell className="text-right text-sm">
                  <span className="flex items-center justify-end gap-1">
                    <Eye className="w-3 h-3" />{item.viewCount}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {trash ? (
                      <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(item.id)} data-testid={`button-restore-${item.id}`}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    ) : (
                      <>
                        <Link href={`/news/${item.id}/edit`}>
                          <Button size="icon" variant="ghost" data-testid={`button-edit-${item.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-${item.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{item.title}" {t("confirmDeleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>{t("delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("page")} {page} {t("of")} {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t("previous")}</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
