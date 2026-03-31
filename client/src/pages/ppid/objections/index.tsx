import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Eye, FileSpreadsheet, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pending:   "Menunggu",
  in_review: "Sedang Diproses",
  resolved:  "Selesai",
  rejected:  "Ditolak",
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  in_review: "bg-blue-100 text-blue-800 border-blue-300",
  resolved:  "bg-green-100 text-green-800 border-green-300",
  rejected:  "bg-red-100 text-red-800 border-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

interface Objection {
  id: string;
  requestCode: string | null;
  fullName: string;
  nik: string;
  phone: string;
  email: string | null;
  status: string;
  objectionReasons: string[] | null;
  createdAt: string;
}

export default function PpidObjectionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export/ppid-objections", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const filename = cd.match(/filename="([^"]+)"/)?.[1] || "ppid-keberatan.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export berhasil", description: filename });
    } catch (e: any) {
      toast({ title: "Export gagal", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const { data, isLoading } = useQuery<{ items: Objection[]; total: number }>({
    queryKey: ["/api/admin/ppid/objections", {
      page: String(page),
      limit: "20",
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
    }],
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" /> Keberatan
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{total} keberatan masuk</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? "Mengekspor..." : "Export Excel"}
          </Button>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="in_review">Sedang Diproses</SelectItem>
              <SelectItem value="resolved">Selesai</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            placeholder="Cari nama, NIK, telepon, kode permohonan..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            data-testid="input-search"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" variant="outline" data-testid="button-search">Cari</Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pemohon</TableHead>
              <TableHead>Kode Permohonan</TableHead>
              <TableHead>Alasan Keberatan</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32">Tanggal</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada keberatan masuk"}
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => (
                <TableRow key={item.id} data-testid={`row-objection-${item.id}`}>
                  <TableCell>
                    <div className="font-medium">{item.fullName}</div>
                    <div className="text-xs text-muted-foreground">NIK: {item.nik}</div>
                    <div className="text-xs text-muted-foreground">{item.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {item.requestCode || <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.objectionReasons?.length ? (
                      <span className="text-xs">
                        {item.objectionReasons.slice(0, 2).join(", ")}
                        {item.objectionReasons.length > 2 && ` +${item.objectionReasons.length - 2} lainnya`}
                      </span>
                    ) : <span className="text-muted-foreground italic text-xs">—</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.createdAt), "d MMM yyyy", { locale: id })}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(`/ppid/objections/${item.id}`)}
                      data-testid={`button-detail-${item.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
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
