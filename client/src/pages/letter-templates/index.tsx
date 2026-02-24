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
import { Plus, Edit, FileEdit, Copy, CheckCircle2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
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
  { key: "{{full_name}}", label: "Nama Lengkap", sample: "Budi Santoso" },
  { key: "{{request_number}}", label: "Nomor Permohonan", sample: "BAPPERIDA-RID-2025-000001" },
  { key: "{{nim_nik}}", label: "NIM/NIK", sample: "12345678" },
  { key: "{{institution}}", label: "Asal Lembaga", sample: "Universitas Palangka Raya" },
  { key: "{{research_title}}", label: "Judul Penelitian", sample: "Analisis Pembangunan Daerah Kalimantan Tengah" },
  { key: "{{research_location}}", label: "Lokasi Penelitian", sample: "Kota Palangka Raya" },
  { key: "{{research_duration}}", label: "Durasi Penelitian", sample: "3 Bulan (Januari - Maret 2025)" },
  { key: "{{date}}", label: "Tanggal Surat", sample: "23 Februari 2025" },
  { key: "{{signer_name}}", label: "Nama Penanda Tangan", sample: "Kepala BAPPERIDA Prov. Kalteng" },
];

function fillTemplate(content: string, sampleData: boolean = false): string {
  let result = content;
  if (sampleData) {
    PLACEHOLDERS.forEach(ph => { result = result.replaceAll(ph.key, ph.sample); });
  }
  return result;
}

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
        <p className="text-xs text-muted-foreground">Klik untuk menyisipkan di posisi kursor:</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(ph => (
            <button
              key={ph.key}
              type="button"
              onClick={() => insertPlaceholder(ph.key)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors font-mono"
              title={ph.label}
            >
              {copied === ph.key ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {ph.key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Konten Template (teks biasa + placeholder)</Label>
        <p className="text-xs text-muted-foreground">
          Tulis konten sebagai teks biasa. Placeholder akan diganti otomatis saat generate surat.
          Jangan gunakan tag HTML — konten akan diformat sebagai dokumen Word.
        </p>
        <Textarea
          id="template-content"
          {...register("content", { required: true })}
          rows={16}
          placeholder={`PEMERINTAH PROVINSI KALIMANTAN TENGAH\nBADAN PERENCANAAN, PENELITIAN DAN PENGEMBANGAN DAERAH (BAPPERIDA)\n\nSURAT IZIN PENELITIAN\nNomor: {{request_number}}\n\nYang bertanda tangan di bawah ini, Kepala BAPPERIDA...\n\nNama           : {{full_name}}\nNIM/NIK        : {{nim_nik}}\nAsal Lembaga   : {{institution}}\nJudul          : {{research_title}}\nLokasi         : {{research_location}}\nDurasi         : {{research_duration}}\n\nDemikian surat ini diterbitkan.\n\nPalangka Raya, {{date}}\n{{signer_name}}`}
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

function PreviewDialog({ template, onClose }: { template: Template; onClose: () => void }) {
  const [withSample, setWithSample] = useState(true);
  const rendered = fillTemplate(template.content, withSample);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview: {template.name}</DialogTitle>
          <DialogDescription>
            Tampilan konten template surat.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 mb-4">
          <Button
            size="sm"
            variant={withSample ? "default" : "outline"}
            onClick={() => setWithSample(true)}
          >
            Dengan Data Contoh
          </Button>
          <Button
            size="sm"
            variant={!withSample ? "default" : "outline"}
            onClick={() => setWithSample(false)}
          >
            Tampilkan Placeholder
          </Button>
        </div>
        <div className="bg-white border rounded-lg p-8 shadow-inner">
          <pre className="whitespace-pre-wrap font-serif text-sm text-gray-800 leading-relaxed">
            {rendered}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LetterTemplatesPage() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | undefined>();
  const [previewTemplate, setPreviewTemplate] = useState<Template | undefined>();
  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: ["/api/admin/letter-templates"] });

  const typeLabel: Record<string, string> = {
    research_permit: "Izin Penelitian",
    general: "Umum",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileEdit className="w-6 h-6" /> {t("templates")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("templateSubtitle")}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditTemplate(undefined); setOpen(true); }} data-testid="button-add-template">
          <Plus className="w-4 h-4" /> {t("addTemplate")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditTemplate(undefined); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Tambah Template"}</DialogTitle>
            <DialogDescription>
              Gunakan placeholder untuk data yang akan diisi otomatis. Konten dalam format teks biasa.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm template={editTemplate} onDone={() => { setOpen(false); setEditTemplate(undefined); }} />
        </DialogContent>
      </Dialog>

      {previewTemplate && (
        <PreviewDialog template={previewTemplate} onClose={() => setPreviewTemplate(undefined)} />
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-16">
            <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Belum ada template surat</p>
            <p className="text-xs mt-1">Tambah template untuk generate surat izin penelitian</p>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTemplate(t)}
                      data-testid={`button-preview-template-${t.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setEditTemplate(t); setOpen(true); }}
                      data-testid={`button-edit-template-${t.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Diperbarui: {format(new Date(t.createdAt), "d MMMM yyyy", { locale: id })}
                </p>
                <div className="p-3 bg-muted rounded-md font-mono">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4 overflow-hidden">
                    {t.content.substring(0, 300)}{t.content.length > 300 ? "..." : ""}
                  </pre>
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
