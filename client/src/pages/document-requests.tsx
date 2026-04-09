import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/contexts/language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileQuestion, Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { PpidInfoRequest } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  in_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu",
  in_review: "Diproses",
  completed: "Selesai",
  rejected: "Ditolak",
};

interface PagedResult {
  items: PpidInfoRequest[];
  total: number;
  page: number;
  totalPages: number;
}

export default function DocumentRequestsPage() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PagedResult>({
    queryKey: ["/api/admin/ppid/info-requests", page, search],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/ppid/info-requests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
          <FileQuestion className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("docReqTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("docReqSubtitle")}</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search-doc-requests"
              />
            </div>
            {data && (
              <span className="text-xs text-muted-foreground ml-auto">
                {t("totalData")}: <b>{data.total}</b>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("noData")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("name")} / NIK</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("phone")} / {t("email")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("requestPurpose")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("informationDetail")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("status")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docResponseFile")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr
                      key={item.id}
                      className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      data-testid={`row-doc-request-${item.id}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium leading-tight">{item.fullName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.nik}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="leading-tight">{item.phone}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.email || "–"}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="block text-xs leading-relaxed line-clamp-3">{item.requestPurpose}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="block text-xs leading-relaxed line-clamp-3">{item.informationDetail}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] px-2 py-0.5 font-medium border-0 ${STATUS_COLORS[item.status] || ""}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.responseFileUrl ? (
                          <a
                            href={item.responseFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`link-response-file-${item.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {t("viewFile")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground text-xs">
                {t("page")} {page} {t("of")} {data.totalPages}
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
                  disabled={page >= data.totalPages}
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
