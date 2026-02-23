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
import { Eye, Search, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Permit {
  id: string; requestNumber: string; fullName: string; email: string;
  institution: string; researchTitle: string; status: string; createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Diajukan",
  in_review: "Dalam Review",
  revision_requested: "Revisi",
  approved: "Disetujui",
  generated_letter: "Surat Dibuat",
  sent: "Terkirim",
  rejected: "Ditolak",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  in_review: "secondary",
  revision_requested: "secondary",
  approved: "default",
  generated_letter: "default",
  sent: "default",
  rejected: "destructive",
};

export default function PermitsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const params = { page: String(page), limit: "15", ...(search ? { search } : {}), ...(status !== "all" ? { status } : {}) };
  const { data, isLoading } = useQuery<{ items: Permit[]; total: number }>({ queryKey: ["/api/admin/permits", params] });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Izin Penelitian</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} total permohonan</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari nama, judul, nomor..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">No. Permohonan</TableHead>
              <TableHead>Pemohon</TableHead>
              <TableHead>Judul Penelitian</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-32">Tanggal</TableHead>
              <TableHead className="w-16 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Belum ada permohonan</TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id} data-testid={`row-permit-${item.id}`}>
                <TableCell className="font-mono text-xs">{item.requestNumber}</TableCell>
                <TableCell>
                  <div className="font-medium">{item.fullName}</div>
                  <div className="text-xs text-muted-foreground">{item.institution}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="line-clamp-2">{item.researchTitle}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[item.status] || "outline"}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(item.createdAt), "d MMM yyyy", { locale: id })}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Link href={`/permits/${item.id}`}>
                      <Button size="icon" variant="ghost" data-testid={`button-detail-${item.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </TableCell>
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
