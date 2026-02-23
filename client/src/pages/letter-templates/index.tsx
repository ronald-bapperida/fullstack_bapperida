import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Template { id: string; name: string; content: string; isActive: boolean; createdAt: string; }

function TemplateForm({ template, onDone }: { template?: Template; onDone: () => void }) {
  const { toast } = useToast();
  const { register, handleSubmit } = useForm({ defaultValues: { name: template?.name || "", content: template?.content || "" } });
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = template
        ? await apiRequest("PATCH", `/api/admin/letter-templates/${template.id}`, data)
        : await apiRequest("POST", "/api/admin/letter-templates", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/letter-templates"] }); toast({ title: "Template disimpan" }); onDone(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Nama Template</Label>
        <Input {...register("name", { required: true })} placeholder="Template Surat Izin Penelitian" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Konten HTML</Label>
        <p className="text-xs text-muted-foreground">Gunakan placeholder: {"{{full_name}}"}, {"{{request_number}}"}, {"{{institution}}"}, {"{{research_title}}"}, {"{{research_location}}"}, {"{{research_duration}}"}, {"{{date}}"}, {"{{signer_name}}"}, {"{{nim_nik}}"}</p>
        <Textarea {...register("content", { required: true })} rows={12} placeholder="<html>..." className="font-mono text-sm" />
      </div>
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}

export default function LetterTemplatesPage() {
  const [open, setOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | undefined>();
  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: ["/api/admin/letter-templates"] });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileEdit className="w-6 h-6" /> Template Surat</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola template surat izin penelitian</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditTemplate(undefined); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Tambah Template
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditTemplate(undefined); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? "Edit Template" : "Tambah Template"}</DialogTitle></DialogHeader>
          <TemplateForm template={editTemplate} onDone={() => { setOpen(false); setEditTemplate(undefined); }} />
        </DialogContent>
      </Dialog>

      {isLoading ? <Skeleton className="h-48 w-full" /> : templates.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Belum ada template</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover-elevate">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Button size="icon" variant="ghost" onClick={() => { setEditTemplate(t); setOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Diperbarui: {format(new Date(t.createdAt), "d MMMM yyyy", { locale: id })}
                </p>
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-xs font-mono text-muted-foreground line-clamp-3">{t.content.replace(/<[^>]*>/g, " ").trim()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
