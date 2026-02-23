import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Image, Eye, MousePointerClick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";

interface Banner {
  id: string; title: string; placement: string; isActive: boolean;
  linkType: string; linkUrl: string | null; viewCount: number; clickCount: number;
  imageDesktop: string | null; imageMobile: string | null;
  startAt: string | null; endAt: string | null; createdAt: string;
}

function BannerForm({ banner, onDone }: { banner?: Banner; onDone: () => void }) {
  const { toast } = useToast();
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      title: banner?.title || "",
      placement: banner?.placement || "home",
      linkType: banner?.linkType || "external",
      linkUrl: banner?.linkUrl || "",
      isActive: banner?.isActive ?? true,
      startAt: banner?.startAt ? banner.startAt.split("T")[0] : "",
      endAt: banner?.endAt ? banner.endAt.split("T")[0] : "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, String(v)); });
      const res = banner
        ? await apiRequest("PATCH", `/api/admin/banners/${banner.id}`, fd)
        : await apiRequest("POST", "/api/admin/banners", fd);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] }); toast({ title: banner ? "Banner diupdate" : "Banner dibuat" }); onDone(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Judul Banner</Label>
        <Input {...register("title", { required: true })} placeholder="Judul Banner" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Placement</Label>
          <Input {...register("placement")} placeholder="home, news, dll" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Tipe Link</Label>
          <Controller name="linkType" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="page">Halaman</SelectItem>
                <SelectItem value="news">Berita</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>URL Link</Label>
        <Input {...register("linkUrl")} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Mulai Tayang</Label>
          <Input type="date" {...register("startAt")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Selesai Tayang</Label>
          <Input type="date" {...register("endAt")} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Controller name="isActive" control={control} render={({ field }) => (
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        )} />
        <Label>Aktif</Label>
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Menyimpan..." : (banner ? "Update" : "Simpan")}
      </Button>
    </form>
  );
}

export default function BannersPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | undefined>();
  const { data: banners = [], isLoading } = useQuery<Banner[]>({ queryKey: ["/api/admin/banners"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/banners/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] }); toast({ title: "Banner dihapus" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Image className="w-6 h-6" /> Banner</h1>
          <p className="text-muted-foreground text-sm mt-1">{banners.length} banner</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditBanner(undefined); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Tambah Banner
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditBanner(undefined); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBanner ? "Edit Banner" : "Tambah Banner"}</DialogTitle></DialogHeader>
          <BannerForm banner={editBanner} onDone={() => { setOpen(false); setEditBanner(undefined); }} />
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24 text-center">Views</TableHead>
              <TableHead className="w-24 text-center">Clicks</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : banners.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Belum ada banner</TableCell></TableRow>
            ) : banners.map(b => (
              <TableRow key={b.id} data-testid={`row-banner-${b.id}`}>
                <TableCell>
                  <div className="font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.placement} · {b.linkType}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? "default" : "secondary"}>{b.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1 text-sm"><Eye className="w-3 h-3" />{b.viewCount}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1 text-sm"><MousePointerClick className="w-3 h-3" />{b.clickCount}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditBanner(b); setOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Banner?</AlertDialogTitle>
                          <AlertDialogDescription>Banner "{b.title}" akan dihapus.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(b.id)}>Hapus</AlertDialogAction>
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
