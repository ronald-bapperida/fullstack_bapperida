import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";

interface Category { id: string; name: string; slug: string; description: string | null; createdAt: string; }

function CategoryForm({ cat, onDone }: { cat?: Category; onDone: () => void }) {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { name: cat?.name || "", slug: cat?.slug || "", description: cat?.description || "" } });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = cat
        ? await apiRequest("PATCH", `/api/admin/news-categories/${cat.id}`, data)
        : await apiRequest("POST", "/api/admin/news-categories", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-categories"] });
      toast({ title: cat ? "Kategori diupdate" : "Kategori dibuat" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Nama Kategori</Label>
        <Input {...register("name", { required: true })} placeholder="Contoh: Pembangunan Daerah" data-testid="input-category-name" />
        {errors.name && <p className="text-destructive text-xs">Wajib diisi</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Slug</Label>
        <Input {...register("slug")} placeholder="pembangunan-daerah (opsional)" data-testid="input-category-slug" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Deskripsi</Label>
        <Textarea {...register("description")} placeholder="Deskripsi singkat kategori" data-testid="input-category-desc" />
      </div>
      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-category">
        {mutation.isPending ? "Menyimpan..." : (cat ? "Update" : "Simpan")}
      </Button>
    </form>
  );
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>();
  const { data: cats = [], isLoading } = useQuery<Category[]>({ queryKey: ["/api/news-categories"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/news-categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/news-categories"] }); toast({ title: "Kategori dihapus" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6" /> Kategori Berita</h1>
          <p className="text-muted-foreground text-sm mt-1">{cats.length} kategori</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditCat(undefined); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={() => setEditCat(undefined)} data-testid="button-add-category">
              <Plus className="w-4 h-4" /> Tambah Kategori
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editCat ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
            </DialogHeader>
            <CategoryForm cat={editCat} onDone={() => { setOpen(false); setEditCat(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : cats.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Belum ada kategori</TableCell></TableRow>
            ) : cats.map(c => (
              <TableRow key={c.id} data-testid={`row-cat-${c.id}`}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.description || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditCat(c); setOpen(true); }} data-testid={`button-edit-cat-${c.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-cat-${c.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
                          <AlertDialogDescription>Kategori "{c.name}" akan dihapus.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Hapus</AlertDialogAction>
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
