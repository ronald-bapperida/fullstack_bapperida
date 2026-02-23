import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, FileEdit, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Template {
  id: string;
  name: string;
  type: string | null;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const PLACEHOLDERS = [
  { key: "{{full_name}}", label: "Nama Lengkap" },
  { key: "{{request_number}}", label: "Nomor Permohonan" },
  { key: "{{nim_nik}}", label: "NIM/NIK" },
  { key: "{{institution}}", label: "Asal Lembaga" },
  { key: "{{research_title}}", label: "Judul Penelitian" },
  { key: "{{research_location}}", label: "Lokasi Penelitian" },
  { key: "{{research_duration}}", label: "Durasi Penelitian" },
  { key: "{{date}}", label: "Tanggal Surat" },
  { key: "{{signer_name}}", label: "Nama Penanda Tangan" },
];

function TemplateForm({ template, onDone }: { template?: Template; onDone: () => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch } = useForm({
    defaultValues: {
      name: template?.name || "",
      type: template?.type || "research_permit",
      content: template?.content || "",
    },
  });

  const content = watch("content");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = template
        ? await apiRequest("PATCH", `/api/admin/letter-templates/${template.id}`, data)
        : await apiRequest("POST", "/api/admin/letter-templates", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/letter-templates"] });
      toast({ title: "Template disimpan" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const insertPlaceholder = (ph: string) => {
    const ta = document.getElementById("template-content") as HTMLTextAreaElement;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, start) + ph + content.substring(end);
      setValue("content", newVal);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + ph.length, start + ph.length); }, 10);
    } else {
      setValue("content", content + ph);
    }
    setCopied(ph);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Nama Template *</Label>
          <Input {...register("name", { required: true })} placeholder="Template Surat Izin Penelitian" data-testid="input-template-name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Tipe</Label>
          <Controller name="type" control={control} render={({ field }) => (
            <Select value={field.value || ""} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="research_permit">Izin Penelitian</SelectItem>
                <SelectItem value="general">Umum</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Placeholder Tersedia</Label>
        <p className="text-xs text-muted-foreground">Klik placeholder untuk menyisipkan di posisi kursor dalam konten template:</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(ph => (
            <button
              key={ph.key}
              type="button"
              onClick={() => insertPlaceholder(ph.key)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors font-mono"
              title={ph.label}
              data-testid={`ph-${ph.key}`}
            >
              {copied === ph.key ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {ph.key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Konten Template</Label>
        <p className="text-xs text-muted-foreground">
          Tulis konten surat sebagai teks biasa. Placeholder akan diganti otomatis saat generate surat.
          Untuk format DOCX, konten akan dirender sebagai paragraf terstruktur.
        </p>
        <Textarea
          id="template-content"
          {...register("content", { required: true })}
          rows={14}
          placeholder="Yang bertanda tangan di bawah ini, Kepala BAPPERIDA...&#10;&#10;Nama     : {{full_name}}&#10;NIM/NIK  : {{nim_nik}}&#10;..."
          className="font-mono text-sm resize-y"
          data-testid="input-template-content"
        />
      </div>

      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-template">
        {mutation.isPending ? "Menyimpan..." : "Simpan Template"}
      </Button>
    </form>
  );
}

export default function LetterTemplatesPage() {
  const [open, setOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | undefined>();
  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: ["/api/admin/letter-templates"] });

  const typeLabel: Record<string, string> = {
    research_permit: "Izin Penelitian",
    general: "Umum",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileEdit className="w-6 h-6" /> Template Surat</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola template surat izin penelitian &mdash; generate sebagai HTML atau DOCX
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditTemplate(undefined); setOpen(true); }} data-testid="button-add-template">
          <Plus className="w-4 h-4" /> Tambah Template
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditTemplate(undefined); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Tambah Template"}</DialogTitle>
            <DialogDescription>
              Template digunakan untuk generate surat izin penelitian. Gunakan placeholder yang tersedia.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm template={editTemplate} onDone={() => { setOpen(false); setEditTemplate(undefined); }} />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-16">
            <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Belum ada template surat</p>
            <p className="text-xs mt-1">Tambah template untuk mulai generate surat izin penelitian</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map(t => (
            <Card key={t.id} data-testid={`card-template-${t.id}`} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.type && (
                      <Badge variant="outline" className="text-xs">
                        {typeLabel[t.type] || t.type}
                      </Badge>
                    )}
                    <Badge variant={t.isActive ? "default" : "secondary"} className="text-xs">
                      {t.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setEditTemplate(t); setOpen(true); }}
                    data-testid={`button-edit-template-${t.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Diperbarui: {format(new Date(t.createdAt), "d MMMM yyyy", { locale: id })}
                </p>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {t.content.replace(/<[^>]*>/g, " ").trim()}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {PLACEHOLDERS.filter(ph => t.content.includes(ph.key)).map(ph => (
                    <Badge key={ph.key} variant="secondary" className="text-xs font-mono">{ph.key}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
