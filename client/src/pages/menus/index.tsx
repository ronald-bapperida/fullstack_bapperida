import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Menu, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import QuillEditor from "@/components/quill-editor";

export default function MenusPage() {
  const { toast } = useToast();
  const { data: menus = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/menus"] });

  const [menuOpen, setMenuOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>();
  const [editMenu, setEditMenu] = useState<any>(undefined);
  const [editItem, setEditItem] = useState<any>(undefined);

  const { register: rm, handleSubmit: hm, control: cm, reset: resetm } = useForm({
    defaultValues: { name: "", location: "mobile", isActive: true },
  });

  const {
    register: ri,
    handleSubmit: hi,
    control: ci,
    reset: reseti,
    watch: watchi,
  } = useForm({
    defaultValues: { menuId: "", title: "", type: "url", value: "", requiresAuth: false, sortOrder: 0 },
  });
  
  const watchedType = watchi("type");

  const menuMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = editMenu
        ? await apiRequest("PATCH", `/api/admin/menus/${editMenu.id}`, data)
        : await apiRequest("POST", "/api/admin/menus", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menus"] });
      toast({ title: "Menu disimpan" });
      setMenuOpen(false);
      resetm({ name: "", location: "mobile", isActive: true });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const itemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = editItem
        ? await apiRequest("PATCH", `/api/admin/menu-items/${editItem.id}`, data)
        : await apiRequest("POST", "/api/admin/menu-items", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menus"] });
      toast({ title: "Menu item disimpan" });
      setItemOpen(false);
      reseti({ menuId: "", title: "", type: "url", value: "", requiresAuth: false, sortOrder: 0 });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/menus/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/menus"] }); toast({ title: "Menu dihapus" }); },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/menu-items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/menus"] }); toast({ title: "Item dihapus" }); },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Menu className="w-6 h-6" /> Menus</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola menu navigasi dinamis</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditMenu(undefined); resetm({ name: "", location: "mobile", isActive: true }); setMenuOpen(true); }}>
          <Plus className="w-4 h-4" /> Tambah Menu
        </Button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMenu ? "Edit Menu" : "Tambah Menu"}</DialogTitle></DialogHeader>
          <form onSubmit={hm(d => menuMutation.mutate(d))} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label>Nama Menu</Label>
              <Input {...rm("name", { required: true })} placeholder="Menu Utama" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Lokasi</Label>
              <Controller name="location" control={cm} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="flex items-center gap-3">
              <Controller name="isActive" control={cm} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              <Label>Aktif</Label>
            </div>
            <Button type="submit" disabled={menuMutation.isPending}>{menuMutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-3xl w-[95vw]">
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Tambah Item"}</DialogTitle></DialogHeader>
          <form onSubmit={hi(d => itemMutation.mutate(d))} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label>Judul</Label>
              <Input {...ri("title", { required: true })} placeholder="Beranda" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipe</Label>
              <Controller name="type" control={ci} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="route">Route</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="page">Halaman</SelectItem>
                    <SelectItem value="news">Berita</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{watchedType === "page" ? "Konten Halaman" : "Value (URL/Route)"}</Label>

              {watchedType === "page" ? (
                <Controller
                  name="value"
                  control={ci}
                  render={({ field }) => (
                    <div className="border rounded-md overflow-hidden max-h-[50vh] overflow-y-auto">
                      <QuillEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Tulis konten halaman..."
                        minHeight={420}
                      />
                    </div>
                  )}
                />
              ) : (
                <Input
                  {...ri("value")}
                  placeholder={watchedType === "route" ? "/beranda" : "https://..."}
                />
              )}
            </div>
            {/* <div className="flex flex-col gap-2">
              <Label>Sort Order</Label>
              <Input type="number" {...ri("sortOrder")} />
            </div> */}
            <div className="flex items-center gap-3">
              <Controller name="requiresAuth" control={ci} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              <Label>Butuh Login</Label>
            </div>
            <Input type="hidden" {...ri("menuId")} value={selectedMenuId || ""} />
            <Button type="submit" disabled={itemMutation.isPending}>{itemMutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? <Skeleton className="h-64 w-full" /> : menus.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Belum ada menu</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {menus.map((menu: any) => (
            <Card key={menu.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{menu.name}</CardTitle>
                    <Badge variant="outline">{menu.location}</Badge>
                    <Badge variant={menu.isActive ? "default" : "secondary"}>{menu.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedMenuId(menu.id); setEditItem(undefined); reseti({ menuId: menu.id, title: "", type: "url", value: "", requiresAuth: false, sortOrder: 0 }); setItemOpen(true); }}>
                      <Plus className="w-3 h-3" /> Item
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditMenu(menu); resetm({ name: menu.name, location: menu.location, isActive: menu.isActive }); setMenuOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Menu?</AlertDialogTitle>
                          <AlertDialogDescription>Menu "{menu.name}" akan dihapus.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMenuMutation.mutate(menu.id)}>Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {menu.items?.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {menu.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-accent/40">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.title}</span>
                          <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                          {/* <span className="text-xs text-muted-foreground">{item.value}</span> */}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setSelectedMenuId(menu.id);
                              setEditItem(item);

                              reseti({
                                menuId: menu.id,
                                title: item.title || "",
                                type: item.type || "url",
                                value: item.value || "",
                                requiresAuth: !!item.requiresAuth,
                                sortOrder: Number(item.sortOrder ?? 0),
                              });

                              setItemOpen(true);
                            }}
                            title="Edit item"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                            title="Hapus item"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada item menu</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
