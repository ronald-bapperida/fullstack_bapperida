import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, FileText, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Doc {
  id: string; title: string; accessLevel: string; status: string;
  fileUrl: string | null; createdAt: string; deletedAt: string | null;
}

function DocForm({ doc, onDone }: { doc?: Doc; onDone: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      title: doc?.title || "",
      accessLevel: doc?.accessLevel || "terbuka",
      status: doc?.status || "draft",
      publishedAt: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, String(v)); });
      if (file) fd.append("file", file);
      const res = doc
        ? await apiRequest("PATCH", `/api/admin/documents/${doc.id}`, fd)
        : await apiRequest("POST", "/api/admin/documents", fd);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] }); toast({ title: "Dokumen disimpan" }); onDone(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Judul Dokumen</Label>
        <Input {...register("title", { required: true })} placeholder="Judul dokumen..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Akses</Label>
          <Controller name="accessLevel" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terbuka">Terbuka</SelectItem>
                <SelectItem value="terbatas">Terbatas</SelectItem>
                <SelectItem value="rahasia">Rahasia</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Controller name="status" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Tanggal Publikasi</Label>
        <Input type="date" {...register("publishedAt")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Upload File (PDF/Gambar)</Label>
        <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files?.[0] || null)} />
      </div>
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [trash, setTrash] = useState(false);

  const params = { page: String(page), limit: "15", ...(search ? { search } : {}), ...(trash ? { trash: "true" } : {}) };
  const { data, isLoading } = useQuery<{ items: Doc[]; total: number }>({ queryKey: ["/api/admin/documents", params] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/documents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] }); toast({ title: "Dokumen dihapus" }); },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/documents/${id}/restore`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] }); toast({ title: "Dokumen dipulihkan" }); },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Dokumen PPID</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} dokumen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={trash ? "default" : "outline"} size="sm" onClick={() => { setTrash(!trash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
          {!trash && (
            <Button size="sm" className="gap-2" onClick={() => { setEditDoc(undefined); setOpen(true); }}>
              <Plus className="w-4 h-4" /> Tambah Dokumen
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditDoc(undefined); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editDoc ? "Edit Dokumen" : "Tambah Dokumen"}</DialogTitle></DialogHeader>
          <DocForm doc={editDoc} onDone={() => { setOpen(false); setEditDoc(undefined); }} />
        </DialogContent>
      </Dialog>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari dokumen..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead className="w-28">Akses</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24">File</TableHead>
              <TableHead className="w-32">Tanggal</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Belum ada dokumen</TableCell></TableRow>
            ) : items.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell><Badge variant="outline">{d.accessLevel}</Badge></TableCell>
                <TableCell><Badge variant={d.status === "published" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                <TableCell>
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-sm">
                      <ExternalLink className="w-3 h-3" /> Lihat
                    </a>
                  ) : <span className="text-muted-foreground text-sm">-</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(d.createdAt), "d MMM yyyy", { locale: id })}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {trash ? (
                      <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(d.id)}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditDoc(d); setOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Dokumen?</AlertDialogTitle>
                              <AlertDialogDescription>"{d.title}" akan dipindahkan ke trash.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(d.id)}>Hapus</AlertDialogAction>
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
