import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { Plus, Edit, Eye, FileEdit } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Template {
  id: string;
  name: string;
  type: string | null;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const PLACEHOLDERS = [
  "{{full_name}}",
  "{{request_number}}",
  "{{nim_nik}}",
  "{{institution}}",
  "{{research_title}}",
  "{{research_location}}",
  "{{research_duration}}",
  "{{date}}",
  "{{signer_name}}",
];

function stripHtml(html: string) {
  if (!html) return "";
  // safe-ish: remove tags for preview excerpt
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function LetterTemplatesPage() {
  const [, setLocation] = useLocation();

  const { data: templates = [], isLoading, error } = useQuery<Template[]>({
    queryKey: ["/api/admin/letter-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/letter-templates");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const typeLabel = useMemo<Record<string, string>>(
    () => ({
      research_permit: "Izin Penelitian",
      general: "Umum",
    }),
    [],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileEdit className="w-6 h-6" />
            Template Surat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola template surat izin penelitian (editor di halaman terpisah agar tidak bentrok dengan dialog TinyMCE).
          </p>
        </div>

        <Button className="gap-2" onClick={() => setLocation("/letter-templates/new")} data-testid="button-add-template">
          <Plus className="w-4 h-4" />
          Tambah Template
        </Button>
      </div>

      {/* Error state */}
      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-600">
            Gagal memuat template: {(error as any)?.message || "Unknown error"}
          </CardContent>
        </Card>
      ) : null}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Belum ada template surat</p>
            <p className="text-xs mt-1">Klik “Tambah Template” untuk mulai membuat template.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => {
            const excerpt = stripHtml(t.content).slice(0, 260);
            const usedPlaceholders = PLACEHOLDERS.filter((ph) => t.content?.includes(ph));

            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow" data-testid={`card-template-${t.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{t.name}</CardTitle>

                        {t.type ? (
                          <Badge variant="outline" className="text-xs">
                            {typeLabel[t.type] || t.type}
                          </Badge>
                        ) : null}

                        <Badge variant={t.isActive ? "default" : "secondary"} className="text-xs">
                          {t.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Dibuat:{" "}
                        {t.createdAt
                          ? format(new Date(t.createdAt), "d MMMM yyyy", { locale: idLocale })
                          : "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/letter-templates/${t.id}`)}
                        data-testid={`button-preview-template-${t.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setLocation(`/letter-templates/${t.id}/edit`)}
                        data-testid={`button-edit-template-${t.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="bg-muted rounded-md p-3">
                    <p className="text-sm text-muted-foreground">{excerpt}{stripHtml(t.content).length > 260 ? "…" : ""}</p>
                  </div>

                  {usedPlaceholders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {usedPlaceholders.map((ph) => (
                        <Badge key={ph} variant="secondary" className="text-xs font-mono">
                          {ph}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Tidak ada placeholder terdeteksi di template ini.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}