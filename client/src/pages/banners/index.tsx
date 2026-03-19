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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Image, Eye, MousePointerClick, Upload, X, Monitor, Smartphone, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";

interface Banner {
  id: string; title: string; placement: string; isActive: boolean;
  linkType: string; linkUrl: string | null; viewCount: number; clickCount: number;
  imageDesktop: string | null; imageMobile: string | null; altText: string | null;
  startAt: string | null; endAt: string | null; createdAt: string; deletedAt: string | null;
}

function ImagePreviewField({
  label, icon, preview, onClear, inputId, onFileChange, testId
}: {
  label: string;
  icon: React.ReactNode;
  preview: string | null;
  onClear: () => void;
  inputId: string;
  onFileChange: (f: File) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1">{icon}{label}</Label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="w-full aspect-video object-cover rounded-md border" />
          <Button
            type="button" size="icon" variant="outline"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={onClear}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex flex-col items-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Klik untuk upload gambar</span>
          <span className="text-xs text-muted-foreground">JPG, PNG, WEBP</span>
        </label>
      )}
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept=".jpg,.jpeg,.png,.webp"
        data-testid={testId}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
      />
    </div>
  );
}

function BannerForm({ banner, onDone }: { banner?: Banner; onDone: () => void }) {
  const { toast } = useToast();
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState<string | null>(banner?.imageDesktop || null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(banner?.imageMobile || null);

  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      title: banner?.title || "",
      placement: banner?.placement || "home",
      altText: banner?.altText || "",
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
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      if (desktopFile) fd.append("imageDesktop", desktopFile);
      if (mobileFile) fd.append("imageMobile", mobileFile);
      const res = banner
        ? await apiRequest("PATCH", `/api/admin/banners/${banner.id}`, fd)
        : await apiRequest("POST", "/api/admin/banners", fd);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: banner ? "Banner diupdate" : "Banner dibuat" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Judul Banner *</Label>
        <Input {...register("title", { required: true })} placeholder="Judul Banner" data-testid="input-banner-title" />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Alt Text (aksesibilitas)</Label>
        <Input {...register("altText")} placeholder="Deskripsi gambar untuk screen reader..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Placement</Label>
          <Controller name="placement" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Beranda</SelectItem>
                <SelectItem value="news">Berita</SelectItem>
                <SelectItem value="sidebar">Sidebar</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Tipe Link</Label>
          <Controller name="linkType" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External URL</SelectItem>
                <SelectItem value="page">Halaman Internal</SelectItem>
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

      <div className="grid grid-cols-1 gap-4">
        <ImagePreviewField
          label="Gambar Desktop"
          icon={<Monitor className="w-3 h-3" />}
          preview={desktopPreview}
          onClear={() => { setDesktopFile(null); setDesktopPreview(null); }}
          inputId="desktop-upload"
          testId="input-banner-desktop"
          onFileChange={(f) => { setDesktopFile(f); setDesktopPreview(URL.createObjectURL(f)); }}
        />
        <ImagePreviewField
          label="Gambar Mobile"
          icon={<Smartphone className="w-3 h-3" />}
          preview={mobilePreview}
          onClear={() => { setMobileFile(null); setMobilePreview(null); }}
          inputId="mobile-upload"
          testId="input-banner-mobile"
          onFileChange={(f) => { setMobileFile(f); setMobilePreview(URL.createObjectURL(f)); }}
        />
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

      <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
        <Controller name="isActive" control={control} render={({ field }) => (
          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-banner-active" />
        )} />
        <div>
          <Label className="cursor-pointer">Aktifkan Banner</Label>
          <p className="text-xs text-muted-foreground">Banner aktif akan tampil di portal publik</p>
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-banner">
        {mutation.isPending ? "Menyimpan..." : (banner ? "Update Banner" : "Simpan Banner")}
      </Button>
    </form>
  );
}

export default function BannersPage() {
  const { toast } = useToast();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | undefined>();
  const [trash, setTrash] = useState(false);

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners", { trash: trash ? "true" : undefined }]
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "Banner dihapus" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeBanners = banners.filter(b => !b.deletedAt && b.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Image className="w-6 h-6" /> {t("bannerTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {banners.length} banner &middot; {activeBanners} {t("active").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={trash ? "default" : "outline"}
            size="sm"
            onClick={() => setTrash(!trash)}
            data-testid="button-toggle-trash"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {trash ? t("exitTrash") : t("trash")}
          </Button>
          {!trash && (
            <Button size="sm" className="gap-2" onClick={() => { setEditBanner(undefined); setOpen(true); }} data-testid="button-add-banner">
              <Plus className="w-4 h-4" /> {t("addBanner")}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditBanner(undefined); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBanner ? t("editBanner") : t("addBanner")}</DialogTitle>
            <DialogDescription>Upload gambar desktop dan mobile untuk tampilan optimal.</DialogDescription>
          </DialogHeader>
          <BannerForm banner={editBanner} onDone={() => { setOpen(false); setEditBanner(undefined); }} />
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t("bannerGambar")}</TableHead>
              <TableHead>{t("bannerJudulPlacement")}</TableHead>
              <TableHead className="w-28">{t("status")}</TableHead>
              <TableHead className="w-24 text-center">{t("bannerViews")}</TableHead>
              <TableHead className="w-24 text-center">{t("bannerClicks")}</TableHead>
              <TableHead className="w-24 text-right">{t("action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : banners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {trash ? "Tidak ada banner di trash" : "Belum ada banner"}
                </TableCell>
              </TableRow>
            ) : banners.map(b => (
              <TableRow key={b.id} data-testid={`row-banner-${b.id}`}>
                <TableCell>
                  {b.imageMobile ? (
                    <img src={b.imageMobile} alt={b.altText || b.title} className="w-20 aspect-video object-cover rounded" />
                  ) : (
                    <div className="w-20 aspect-video bg-muted rounded flex items-center justify-center">
                      <Image className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs py-0">{b.placement}</Badge>
                    {b.linkUrl && <span className="truncate max-w-[140px]">{b.linkUrl}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? "default" : "secondary"}>
                    {b.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1 text-sm">
                    <Eye className="w-3 h-3" />{b.viewCount}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1 text-sm">
                    <MousePointerClick className="w-3 h-3" />{b.clickCount}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {!trash ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditBanner(b); setOpen(true); }} data-testid={`button-edit-${b.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-${b.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
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
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" title="Pulihkan" data-testid={`button-restore-${b.id}`}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
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
