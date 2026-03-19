import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useLang } from "@/contexts/language";

const SURVEY_QUESTIONS = [
  "Persyaratan Pelayanan",
  "Prosedur Pelayanan",
  "Waktu Pelayanan",
  "Biaya/Tarif Pelayanan",
  "Produk Layanan",
  "Kompetensi Petugas",
  "Perilaku Pelaksana",
  "Sarana & Prasarana",
  "Penanganan Pengaduan",
];

interface Survey {
  id: string; respondentName: string; age: number; gender: string;
  education: string; occupation: string; q1: number; q2: number;
  q3: number; q4: number; q5: number; q6: number; q7: number; q8: number; q9: number;
  suggestion: string | null; createdAt: string;
}

function calcIKM(s: Survey) {
  const total = s.q1 + s.q2 + s.q3 + s.q4 + s.q5 + s.q6 + s.q7 + s.q8 + s.q9;
  return ((total / (9 * 4)) * 100).toFixed(1);
}

export default function SurveysPage() {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ items: Survey[]; total: number }>({
    queryKey: ["/api/admin/surveys", { page: String(page), limit: "15" }],
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const avgIKM = items.length > 0
    ? (items.reduce((acc, s) => acc + parseFloat(calcIKM(s)), 0) / items.length).toFixed(1)
    : "-";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart2 className="w-6 h-6" /> {t("surveyTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} {t("totalRespondents").toLowerCase()}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("totalRespondents")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("avgIKM")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{avgIKM}{avgIKM !== "-" ? "%" : ""}</div></CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("surveyRespondent")}</TableHead>
              <TableHead className="w-16">{t("surveyAge")}</TableHead>
              <TableHead className="w-24">{t("surveyGender")}</TableHead>
              <TableHead>{t("surveyEducation")}</TableHead>
              <TableHead className="w-20 text-center">{t("surveyScore")}</TableHead>
              <TableHead className="w-32">{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Belum ada data survei</TableCell></TableRow>
            ) : items.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.respondentName}</div>
                  <div className="text-xs text-muted-foreground">{s.occupation}</div>
                </TableCell>
                <TableCell>{s.age}</TableCell>
                <TableCell className="capitalize">{s.gender === "laki_laki" ? "Laki-laki" : "Perempuan"}</TableCell>
                <TableCell className="text-sm">{s.education}</TableCell>
                <TableCell className="text-center font-bold text-primary">{calcIKM(s)}%</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(s.createdAt), "d MMM yyyy", { locale: id })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  );
}
