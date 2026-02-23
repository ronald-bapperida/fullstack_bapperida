import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Suggestion {
  id: string; name: string | null; email: string | null; message: string; createdAt: string;
}

export default function SuggestionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ items: Suggestion[]; total: number }>({
    queryKey: ["/api/admin/suggestions", { page: String(page), limit: "15" }],
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6" /> Kotak Saran</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} saran masuk</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengirim</TableHead>
              <TableHead>Pesan</TableHead>
              <TableHead className="w-32">Tanggal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 3 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">Belum ada saran masuk</TableCell></TableRow>
            ) : items.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name || "Anonim"}</div>
                  <div className="text-xs text-muted-foreground">{s.email || "-"}</div>
                </TableCell>
                <TableCell className="text-sm">{s.message}</TableCell>
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
