import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEHOLDERS = [
  { key: "{{full_name}}", sample: "Budi Santoso" },
  { key: "{{request_number}}", sample: "BAPPERIDA-2026-000001" },
  { key: "{{nim_nik}}", sample: "12345678" },
  { key: "{{institution}}", sample: "Universitas Palangka Raya" },
  { key: "{{research_title}}", sample: "Analisis Pembangunan Daerah" },
  { key: "{{research_location}}", sample: "Palangka Raya" },
  { key: "{{research_duration}}", sample: "3 Bulan" },
  { key: "{{date}}", sample: "25 Februari 2026" },
  { key: "{{signer_name}}", sample: "Kepala BAPPERIDA" },
];

function fillTemplate(html: string, sample = true) {
  let out = html || "";
  if (sample) PLACEHOLDERS.forEach(p => (out = out.replaceAll(p.key, p.sample)));
  return out;
}

function unwrapApi(json: any) {
  // support: {data}, {success,data}, plain object
  if (!json) return null;
  if (json.data) return json.data;
  if (json.success && json.data) return json.data;
  return json;
}

export default function LetterTemplatePreviewPage() {
  const [, params] = useRoute("/letter-templates/:id");
  const id = params?.id as string | undefined;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/admin/letter-templates/${id}`],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/letter-templates/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return unwrapApi(json);
    },
  });

  // fallback key names
  const rawHtml =
    data?.content ??
    data?.contentHtml ??
    data?.html ??
    data?.template ??
    "";

  const rendered = fillTemplate(rawHtml, true);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Preview Template</h1>
          <p className="text-sm text-muted-foreground">Preview dengan data contoh</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/letter-templates")}>Kembali</Button>
          {id && <Button onClick={() => setLocation(`/letter-templates/${id}/edit`)}>Edit</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hasil</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-28 rounded-md border bg-muted animate-pulse" />
          ) : error ? (
            <div className="text-sm text-red-600">Gagal load: {(error as any)?.message}</div>
          ) : !rawHtml ? (
            <div className="text-sm text-muted-foreground">Konten template kosong / tidak terbaca dari API.</div>
          ) : (
            <div className="bg-white border rounded-md p-10">
              <div dangerouslySetInnerHTML={{ __html: rendered }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}