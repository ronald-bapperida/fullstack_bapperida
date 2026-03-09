import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, FileText, ExternalLink, RefreshCw, Search, Filter, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";

interface DocMaster { id: string; name: string; }
interface Doc {
  id: string; title: string; accessLevel: string; status: string; publishedAt: string | null;
  fileUrl: string | null; createdAt: string; deletedAt: string | null;
  kindId: string | null; categoryId: string | null; typeId: string | null;
}

function DocForm({ doc, kinds, categories, types, onDone }: {
  doc?: Doc;
  kinds: DocMaster[];
  categories: DocMaster[];
  types: DocMaster[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      title: doc?.title || "",
      kindId: doc?.kindId || "",
      categoryId: doc?.categoryId || "",
      typeId: doc?.typeId || "",
      accessLevel: doc?.accessLevel || "terbuka",
      status: doc?.status || "draft",
      publishedAt: doc?.publishedAt
                  ? format(new Date(doc.publishedAt), "yyyy-MM-dd'T'HH:mm")
                  : "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (k === "publishedAt") {
          fd.append(k, v ? String(v) : "");
          return;
        }
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      if (file) fd.append("file", file);
      // if (data.publishedAt) {
      //   const dt = new Date(data.publishedAt + "T00:00:00");
      //   fd.set("publishedAt", dt.toISOString());
      // }
      const res = doc
        ? await apiRequest("PATCH", `/api/admin/documents/${doc.id}`, fd)
        : await apiRequest("POST", "/api/admin/documents", fd);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Dokumen disimpan" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Judul Dokumen *</Label>
        <Input {...register("title", { required: "Judul wajib diisi" })} placeholder="Judul dokumen..." data-testid="input-doc-title" />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message as string}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Jenis Dokumen *</Label>
          <Controller name="kindId" control={control} rules={{ required: "Jenis wajib dipilih" }} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger data-testid="select-doc-kind"><SelectValue placeholder="Pilih jenis..." /></SelectTrigger>
              <SelectContent>
                {kinds.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.kindId && <p className="text-xs text-destructive">{errors.kindId.message as string}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Kategori Dokumen *</Label>
          <Controller name="categoryId" control={control} rules={{ required: "Kategori wajib dipilih" }} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger data-testid="select-doc-category"><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message as string}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tipe/Format File *</Label>
          <Controller name="typeId" control={control} rules={{ required: "Tipe wajib dipilih" }} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger data-testid="select-doc-type"><SelectValue placeholder="Pilih tipe file..." /></SelectTrigger>
              <SelectContent>
                {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.typeId && <p className="text-xs text-destructive">{errors.typeId.message as string}</p>}
        </div>
      </div>

      <div className="grid gap-4">
        {/* <div className="flex flex-col gap-2">
          <Label>Level Akses</Label>
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
        </div> */}
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
        <Input type="datetime-local" {...register("publishedAt")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Upload File</Label>
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
          onChange={e => setFile(e.target.files?.[0] || null)}
          data-testid="input-doc-file"
        />
        {doc?.fileUrl && !file && (
          <p className="text-xs text-muted-foreground">
            File saat ini: <a href={doc.fileUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">Lihat file</a>
          </p>
        )}
      </div>

      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-doc">
        {mutation.isPending ? "Menyimpan..." : "Simpan Dokumen"}
      </Button>
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
  const [filterKind, setFilterKind] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [sortBy, setSortBy] = useState<"title" | "publishedAt" | "createdAt">("publishedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: kinds = [] } = useQuery<DocMaster[]>({ queryKey: ["/api/document-kinds"] });
  const { data: categories = [] } = useQuery<DocMaster[]>({ queryKey: ["/api/document-categories"] });
  const { data: types = [] } = useQuery<DocMaster[]>({ queryKey: ["/api/document-types"] });

  const params = {
    page: String(page), limit: "15",
    sortBy, sortDir,
    ...(search ? { search } : {}),
    ...(trash ? { trash: "true" } : {}),
    ...(filterKind ? { kindId: filterKind } : {}),
    ...(filterCategory ? { categoryId: filterCategory } : {}),
  };
  const { data, isLoading } = useQuery<{ items: Doc[]; total: number }>({ queryKey: ["/api/admin/documents", params] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/documents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] }); toast({ title: "Dokumen dihapus" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/documents/${id}/restore`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] }); toast({ title: "Dokumen dipulihkan" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const kindMap = Object.fromEntries(kinds.map(k => [k.id, k.name]));
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]));

  function toggleSort(key: "title" | "publishedAt") {
    setPage(1);
    setSortBy(prev => {
      if (prev !== key) {
        setSortDir(key === "title" ? "asc" : "desc");
        return key;
      }
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  function SortableHead({
    label,
    colKey,
    sortBy,
    sortDir,
    onSort,
    className,
  }: {
    label: React.ReactNode;
    colKey: "title" | "publishedAt";
    sortBy: string;
    sortDir: "asc" | "desc";
    onSort: (key: "title" | "publishedAt") => void;
    className?: string;
  }) {
    const active = sortBy === colKey;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => onSort(colKey)}
          className="inline-flex items-center gap-2 select-none hover:text-foreground"
        >
          <span>{label}</span>
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </TableHead>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Dokumen PPID</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} dokumen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={trash ? "default" : "outline"}
            size="sm"
            onClick={() => { setTrash(!trash); setPage(1); }}
            data-testid="button-toggle-trash"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {trash ? "Keluar Trash" : "Trash"}
          </Button>
          {!trash && (
            <Button size="sm" className="gap-2" onClick={() => { setEditDoc(undefined); setOpen(true); }} data-testid="button-add-doc">
              <Plus className="w-4 h-4" /> Tambah Dokumen
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditDoc(undefined); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDoc ? "Edit Dokumen" : "Tambah Dokumen"}</DialogTitle>
            <DialogDescription>
              Jenis, Kategori, dan Tipe file wajib diisi.
            </DialogDescription>
          </DialogHeader>
          <DocForm
            doc={editDoc}
            kinds={kinds}
            categories={categories}
            types={types}
            onDone={() => { setOpen(false); setEditDoc(undefined); }}
          />
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari dokumen..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-search-doc"
          />
        </div>
        {!trash && (
          <>
            <Select value={filterKind || "all"} onValueChange={v => { setFilterKind(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44" data-testid="select-filter-kind">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {kinds.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory || "all"} onValueChange={v => { setFilterCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44" data-testid="select-filter-category">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
            <SortableHead
                label="Judul"
                colKey="title"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              {/* <TableHead>Judul</TableHead> */}
              <TableHead className="w-32">Jenis</TableHead>
              <TableHead className="w-32">Kategori</TableHead>
              <TableHead className="w-20">Tipe</TableHead>
              {/* <TableHead className="w-24">Akses</TableHead> */}
              <SortableHead
                label="Tanggal Publikasi"
                colKey="publishedAt"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-44"
              />
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {trash ? "Tidak ada dokumen di trash" : "Belum ada dokumen"}
                </TableCell>
              </TableRow>
            ) : items.map(d => (
              <TableRow key={d.id} data-testid={`row-doc-${d.id}`}>
                <TableCell>
                  <div className="font-medium line-clamp-1">{d.title}</div>
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-xs mt-0.5">
                      <ExternalLink className="w-3 h-3" /> Lihat file
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-sm">{d.kindId ? kindMap[d.kindId] || "-" : "-"}</TableCell>
                <TableCell className="text-sm">{d.categoryId ? categoryMap[d.categoryId] || "-" : "-"}</TableCell>
                <TableCell className="text-sm">{d.typeId ? typeMap[d.typeId] || "-" : "-"}</TableCell>
                {/* <TableCell><Badge variant="outline" className="text-xs">{d.accessLevel}</Badge></TableCell> */}
                <TableCell className="text-sm">{d.publishedAt ? format(new Date(d.publishedAt), "dd MMM yyyy HH:mm") : "-"}</TableCell>
                <TableCell><Badge variant={d.status === "published" ? "default" : "secondary"} className="text-xs">{d.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {trash ? (
                      <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(d.id)} data-testid={`button-restore-${d.id}`}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditDoc(d); setOpen(true); }} data-testid={`button-edit-${d.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-${d.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
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
