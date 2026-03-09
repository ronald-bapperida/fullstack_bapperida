import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Layers, Tag, FileType2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Master { 
  id: string; 
  name: string; 
  level?: number; // Tambahkan level (optional karena hanya categories yang punya)
  extension?: string; 
  createdAt: string; 
}

function MasterForm({
  item, apiBase, hasExtension, hasLevel, onDone // Tambah prop hasLevel
}: { 
  item?: Master; 
  apiBase: string; 
  hasExtension?: boolean;
  hasLevel?: boolean; // Prop baru untuk nambahin level
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { 
      name: item?.name || "", 
      level: item?.level || 1,
      extension: item?.extension || "" 
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = { name: data.name };
      if (hasExtension) payload.extension = data.extension;
      if (hasLevel && item?.level !== data.level) {
        const confirmChange = window.confirm(
          `Level ${data.level} sudah memiliki prioritas. Jika digunakan, kategori lama akan dipindahkan ke level 0. Lanjutkan?`
        );
        if (!confirmChange) return;
      }
      
      const res = item
        ? await apiRequest("PATCH", `${apiBase}/${item.id}`, payload)
        : await apiRequest("POST", apiBase, payload);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase.replace("/admin", "")] });
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      toast({ title: item ? "Data diupdate" : "Data ditambahkan" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Nama *</Label>
        <Input {...register("name", { required: "Nama wajib diisi" })} placeholder="Nama..." data-testid="input-master-name" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message as string}</p>}
      </div>
      
      {/* Tambah field level kalau hasLevel true */}
      {hasLevel && (
        <div className="flex flex-col gap-2">
          <Label>Level / Prioritas *</Label>
          <Input 
            type="number"
            min="1"
            step="1"
            {...register("level", { 
              required: "Level wajib diisi",
              min: { value: 1, message: "Level minimal 1" },
              valueAsNumber: true
            })} 
            placeholder="1"
            data-testid="input-category-level" 
          />
          <p className="text-xs text-muted-foreground">
            Level 1 = prioritas tertinggi (tampil pertama)
          </p>
          {errors.level && <p className="text-xs text-destructive">{errors.level.message as string}</p>}
        </div>
      )}
      
      {hasExtension && (
        <div className="flex flex-col gap-2">
          <Label>Ekstensi File</Label>
          <Input {...register("extension")} placeholder="pdf, docx, xlsx (pisahkan koma)" />
          <p className="text-xs text-muted-foreground">Contoh: pdf atau jpg,jpeg</p>
        </div>
      )}
      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-master">
        {mutation.isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}

function MasterPage({
  title, description, icon: Icon, apiBase, queryKey, hasExtension, hasLevel // Tambah prop hasLevel
}: {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  apiBase: string;
  queryKey: string;
  hasExtension?: boolean;
  hasLevel?: boolean; // Prop baru
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Master | undefined>();

  // Sort by level kalau ada hasLevel
  const { data: items = [], isLoading } = useQuery<Master[]>({ 
    queryKey: [queryKey],
    select: (data) => {
      if (hasLevel) {
        return [...data].sort((a, b) => (a.level || 0) - (b.level || 0));
      }
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `${apiBase}/${id}`);
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "Data dihapus" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon className="w-6 h-6" /> {title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditItem(undefined); setOpen(true); }} data-testid="button-add-master">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditItem(undefined); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <MasterForm
            item={editItem}
            apiBase={apiBase}
            hasExtension={hasExtension}
            hasLevel={hasLevel} // Pass hasLevel
            onDone={() => { setOpen(false); setEditItem(undefined); }}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {/* Tambah kolom Level kalau hasLevel true */}
              {hasLevel && <TableHead className="w-20">Level</TableHead>}
              <TableHead>Nama</TableHead>
              {hasExtension && <TableHead className="w-40">Ekstensi</TableHead>}
              <TableHead className="w-36">Ditambahkan</TableHead>
              <TableHead className="w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {hasLevel && <TableCell><Skeleton className="h-5 w-12" /></TableCell>}
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                {hasExtension && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              </TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasExtension ? (hasLevel ? 5 : 4) : (hasLevel ? 4 : 3)} className="text-center py-12 text-muted-foreground">
                  Belum ada data {title}
                </TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.id} data-testid={`row-master-${item.id}`}>
                {/* Tampilkan level kalau hasLevel true */}
                {hasLevel && (
                  <TableCell>
                    <span className="font-mono text-sm bg-primary/10 px-2 py-1 rounded">
                      Level {item.level}
                    </span>
                  </TableCell>
                )}
                <TableCell className="font-medium">{item.name}</TableCell>
                {hasExtension && (
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.extension || "-"}</code>
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(item.createdAt), "d MMM yyyy", { locale: id })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditItem(item); setOpen(true); }} data-testid={`button-edit-${item.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-${item.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus {title}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{item.name}" akan dihapus. Dokumen yang menggunakan data ini mungkin terpengaruh.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function DocKindsPage() {
  return (
    <MasterPage
      title="Jenis Dokumen"
      description="Kelola jenis-jenis dokumen PPID"
      icon={Layers}
      apiBase="/api/admin/document-kinds"
      queryKey="/api/document-kinds"
    />
  );
}

export function DocCategoriesPage() {
  return (
    <MasterPage
      title="Kategori Dokumen"
      description="Kelola kategori dokumen PPID dengan level prioritas (Level 1 = tertinggi)"
      icon={Tag}
      apiBase="/api/admin/document-categories"
      queryKey="/api/document-categories"
      hasLevel={true} // Tambah hasLevel
    />
  );
}

export function DocTypesPage() {
  return (
    <MasterPage
      title="Tipe File"
      description="Kelola tipe/format file dokumen"
      icon={FileType2}
      apiBase="/api/admin/document-types"
      queryKey="/api/document-types"
      hasExtension
    />
  );
}