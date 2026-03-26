import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LetterTemplateForm from "../shared/LetterTemplateForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function unwrapApi(json: any) {
  if (!json) return null;
  if (json.data) return json.data;
  if (json.success && json.data) return json.data;
  return json;
}

export default function LetterTemplateEditPage() {
  const [, params] = useRoute("/letter-templates/:id/edit");
  const id = params?.id as string | undefined;
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/admin/letter-templates/${id}`],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/letter-templates/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const t = unwrapApi(json);

      // normalize shape for form
      return {
        name:             t?.name             ?? "",
        type:             t?.type             ?? "research_permit",
        category:         t?.category         ?? "surat_izin",
        content:          t?.content          ?? t?.contentHtml ?? t?.html ?? t?.template ?? "",
        officialName:     t?.officialName     ?? "",
        officialPosition: t?.officialPosition ?? "",
        officialNip:      t?.officialNip      ?? "",
        city:             t?.city             ?? "Palangka Raya",
        tembusan:         t?.tembusan         ?? "",
        kepada:           t?.kepada           ?? "",
      };
    },
  });

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
        <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={() => setLocation("/letter-templates")} data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>Edit Template Surat</CardTitle>
        </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <LetterTemplateForm
              mode="edit"
              id={id!}
              initial={data}
              onDone={() => setLocation("/letter-templates")}
              onCancel={() => setLocation("/letter-templates")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}