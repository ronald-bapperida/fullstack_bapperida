import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Upload, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface FinalReport {
  id: string; name: string; email: string; researchTitle: string;
  fileUrl: string | null; suggestion: string; createdAt: string;
}

export default function FinalReportsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ items: FinalReport[]; total: number }>({
    queryKey: ["/api/admin/final-reports", { page: String(page), limit: "15" }],
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="w-6 h-6" /> Laporan Akhir Penelitian</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} total laporan</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Peneliti</TableHead>
              <TableHead>Judul Penelitian</TableHead>
              <TableHead>Saran</TableHead>
              <TableHead className="w-24">File</TableHead>
              <TableHead className="w-32">Tanggal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Belum ada laporan akhir</TableCell></TableRow>
            ) : items.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="text-sm">{r.researchTitle}</TableCell>
                <TableCell className="text-sm text-muted-foreground line-clamp-2">{r.suggestion || "-"}</TableCell>
                <TableCell>
                  {r.fileUrl ? (
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-sm">
                      <ExternalLink className="w-3 h-3" /> Lihat
                    </a>
                  ) : <span className="text-muted-foreground text-sm">-</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(r.createdAt), "d MMM yyyy", { locale: id })}</TableCell>
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
