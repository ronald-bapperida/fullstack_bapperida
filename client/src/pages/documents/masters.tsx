import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Layers, Tag, FileType2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Master { 
  id: string; 
  name: string; 
  level?: number | null; // Ubah jadi null untuk yang tidak punya level
  extension?: string; 
  createdAt: string; 
}

interface LevelConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  currentLevel: number;
  conflictingCategory: Master | null;
}

// Komponen dialog konflik level
function LevelConflictDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  currentLevel,
  conflictingCategory
}: LevelConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Konflik Level Prioritas
          </DialogTitle>
          <DialogDescription>
            Level {currentLevel} sudah digunakan oleh kategori lain.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium">Kategori yang akan ditimpa:</p>
            <div className="flex items-center justify-between bg-background p-3 rounded-md border">
              <div className="flex-1">
                <p className="font-medium">{conflictingCategory?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Ditambahkan: {conflictingCategory?.createdAt ? format(new Date(conflictingCategory.createdAt), "d MMM yyyy", { locale: id }) : "-"}
                </p>
              </div>
              <span className="bg-primary/10 px-3 py-1.5 rounded-md font-mono text-sm">
                Level {conflictingCategory?.level}
              </span>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Yang akan terjadi:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Kategori "{conflictingCategory?.name}" akan kehilangan level prioritasnya</li>
                <li>Kategori tersebut akan dipindahkan ke bagian "Tidak Terurut"</li>
                <li>Kategori baru/update akan menggunakan Level {currentLevel}</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Ya, Timpa Level
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MasterForm({
  item, apiBase, hasExtension, hasLevel, onDone
}: { 
  item?: Master; 
  apiBase: string; 
  hasExtension?: boolean;
  hasLevel?: boolean;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [showLevelConflict, setShowLevelConflict] = useState(false);
  const [conflictingCategory, setConflictingCategory] = useState<Master | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: { 
      name: item?.name || "", 
      level: item?.level || 1,
      extension: item?.extension || "" 
    },
  });

  const currentLevel = watch("level");

  // Query untuk cek existing categories
  const { data: existingCategories = [] } = useQuery<Master[]>({ 
    queryKey: [apiBase.replace("/admin", "")],
    enabled: hasLevel // Only run if hasLevel is true
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = { name: data.name };
      if (hasExtension) payload.extension = data.extension;
      if (hasLevel) payload.level = parseInt(data.level);
      
      const res = item
        ? await apiRequest("PATCH", `${apiBase}/${item.id}`, payload)
        : await apiRequest("POST", apiBase, payload);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase.replace("/admin", "")] });
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      toast({ 
        title: "Sukses", 
        description: item ? "Data berhasil diupdate" : "Data berhasil ditambahkan" 
      });
      onDone();
    },
    onError: (e: any) => {
      toast({ 
        title: "Error", 
        description: e.message, 
        variant: "destructive" 
      });
    },
  });

  // Cek konflik level
  const checkLevelConflict = (level: number): Master | null => {
    if (!hasLevel) return null;
    
    return existingCategories.find(
      (cat: Master) => cat.level === level && cat.id !== item?.id
    ) || null;
  };

  // Handle form submit
  const onSubmit = (data: any) => {
    if (hasLevel && data.level) {
      const level = parseInt(data.level);
      const conflict = checkLevelConflict(level);
      
      if (conflict) {
        setConflictingCategory(conflict);
        setPendingData(data);
        setShowLevelConflict(true);
        return;
      }
    }
    
    // Langsung submit kalau tidak ada konflik
    mutation.mutate(data);
  };

  // Handle konfirmasi overwrite
  const handleOverwrite = () => {
    setShowLevelConflict(false);
    if (pendingData) {
      mutation.mutate(pendingData);
    }
  };

  // Handle cancel overwrite
  const handleCancelOverwrite = () => {
    setShowLevelConflict(false);
    setPendingData(null);
    setConflictingCategory(null);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nama *</Label>
          <Input 
            id="name"
            {...register("name", { required: "Nama wajib diisi" })} 
            placeholder="Nama..." 
            data-testid="input-master-name" 
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message as string}</p>}
        </div>
        
        {/* Field level untuk categories */}
        {hasLevel && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="level">Level / Prioritas *</Label>
            <Input 
              id="level"
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
              Level 1 = prioritas tertinggi (tampil pertama). Setiap level harus unik.
            </p>
            {errors.level && <p className="text-xs text-destructive">{errors.level.message as string}</p>}
          </div>
        )}
        
        {/* Field extension untuk types */}
        {hasExtension && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="extension">Ekstensi File</Label>
            <Input 
              id="extension"
              {...register("extension")} 
              placeholder="pdf, docx, xlsx (pisahkan koma)" 
            />
            <p className="text-xs text-muted-foreground">Contoh: pdf atau jpg,jpeg</p>
          </div>
        )}
        
        <Button type="submit" disabled={mutation.isPending} data-testid="button-save-master">
          {mutation.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>

      {/* Dialog Konflik Level */}
      {hasLevel && (
        <LevelConflictDialog
          open={showLevelConflict}
          onOpenChange={setShowLevelConflict}
          onConfirm={handleOverwrite}
          onCancel={handleCancelOverwrite}
          currentLevel={parseInt(pendingData?.level) || 0}
          conflictingCategory={conflictingCategory}
        />
      )}
    </>
  );
}

function MasterPage({
  title, description, icon: Icon, apiBase, queryKey, hasExtension, hasLevel
}: {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  apiBase: string;
  queryKey: string;
  hasExtension?: boolean;
  hasLevel?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Master | undefined>();

  // Query data dengan sorting yang benar
  const { data: items = [], isLoading } = useQuery<Master[]>({ 
    queryKey: [queryKey],
    select: (data) => {
      if (hasLevel) {
        // Pisahkan yang punya level dan tidak punya level
        const withLevel = data
          .filter(item => item.level != null && item.level > 0)
          .sort((a, b) => (a.level || 0) - (b.level || 0));
        
        const withoutLevel = data.filter(item => item.level == null || item.level === 0);
        
        // Gabungkan: yang punya level dulu, baru yang tidak punya level
        return [...withLevel, ...withoutLevel];
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
      toast({ 
        title: "Sukses", 
        description: "Data berhasil dihapus" 
      });
    },
    onError: (e: any) => {
      toast({ 
        title: "Error", 
        description: e.message, 
        variant: "destructive" 
      });
    },
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
        <Button 
          size="sm" 
          className="gap-2" 
          onClick={() => { 
            setEditItem(undefined); 
            setOpen(true); 
          }} 
          data-testid="button-add-master"
        >
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditItem(undefined); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle>
            <DialogDescription>
              {editItem ? "Ubah data yang sudah ada" : "Tambahkan data baru"}
            </DialogDescription>
          </DialogHeader>
          <MasterForm
            item={editItem}
            apiBase={apiBase}
            hasExtension={hasExtension}
            hasLevel={hasLevel}
            onDone={() => { setOpen(false); setEditItem(undefined); }}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {hasLevel && <TableHead className="w-24">Level</TableHead>}
              <TableHead>Nama</TableHead>
              {hasExtension && <TableHead className="w-40">Ekstensi</TableHead>}
              <TableHead className="w-36">Ditambahkan</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {hasLevel && <TableCell><Skeleton className="h-5 w-16" /></TableCell>}
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  {hasExtension && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={hasExtension ? (hasLevel ? 5 : 4) : (hasLevel ? 4 : 3)} 
                  className="text-center py-12 text-muted-foreground"
                >
                  Belum ada data {title}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} data-testid={`row-master-${item.id}`}>
                  {/* Kolom Level */}
                  {hasLevel && (
                    <TableCell>
                      {item.level && item.level > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                          Level {item.level}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Tidak terurut
                        </span>
                      )}
                    </TableCell>
                  )}
                  
                  {/* Kolom Nama */}
                  <TableCell className="font-medium">{item.name}</TableCell>
                  
                  {/* Kolom Ekstensi */}
                  {hasExtension && (
                    <TableCell>
                      {item.extension ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {item.extension}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  
                  {/* Kolom Tanggal */}
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.createdAt), "d MMM yyyy", { locale: id })}
                  </TableCell>
                  
                  {/* Kolom Aksi */}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => { 
                          setEditItem(item); 
                          setOpen(true); 
                        }} 
                        data-testid={`button-edit-${item.id}`}
                      >
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
                              "{item.name}" akan dihapus. 
                              {item.level && item.level > 0 && (
                                <span className="block mt-2 text-destructive">
                                  Level {item.level} akan menjadi tersedia untuk kategori lain.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
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
      hasLevel={true}
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