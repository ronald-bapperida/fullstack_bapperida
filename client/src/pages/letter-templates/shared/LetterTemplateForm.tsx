import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Editor } from "@tinymce/tinymce-react";

import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, ChevronDown, ChevronUp, Info } from "lucide-react";

const DOCX_VARIABLES: { key: string; label: string; source: string }[] = [
  // Dari data pemohon
  { key: "<<NAMA>>",               label: "Nama Pemohon",             source: "permit" },
  { key: "<<KEPADA>>",             label: "Kepada (teks alamat surat, bisa multi-baris)", source: "template" },
  { key: "<<NIM>>",                label: "NIM / NIK Pemohon",        source: "permit" },
  { key: "<<NIM/NIK>>",           label: "NIM atau NIK",              source: "permit" },
  { key: "<<INSTANSI>>",           label: "Instansi Pemohon",         source: "permit" },
  { key: "<<NAMA INSTANSI>>",      label: "Nama Instansi",            source: "permit" },
  { key: "<<JUDUL PENELITIAN>>",   label: "Judul Penelitian",         source: "permit" },
  { key: "<<LOKASI PENELITIAN>>",  label: "Lokasi Penelitian",        source: "permit" },
  { key: "<<DURASI PENELITIAN>>",  label: "Durasi Penelitian",        source: "permit" },
  { key: "<<NOMOR SURAT>>",        label: "Nomor Surat Pengantar",    source: "permit" },
  { key: "<<NOMOR PENGAJUAN>>",    label: "Nomor Pengajuan",          source: "permit" },
  { key: "<<TANGGAL SURAT>>",      label: "Tanggal Surat Pengantar",  source: "permit" },
  { key: "<<TANGGAL PENGAJUAN>>",  label: "Tanggal Pengajuan",        source: "permit" },
  { key: "<<TELEPON>>",            label: "Telepon Pemohon",          source: "permit" },
  { key: "<<EMAIL>>",              label: "Email Pemohon",            source: "permit" },
  { key: "<<ALAMAT>>",             label: "Alamat Pemohon",           source: "permit" },
  // Dari konfigurasi template
  { key: "<<NAMA PEJABAT>>",       label: "Nama Pejabat",             source: "template" },
  { key: "<<JABATAN>>",            label: "Jabatan Pejabat",          source: "template" },
  { key: "<<JABATAN PEJABAT>>",    label: "Jabatan Pejabat (alt)",    source: "template" },
  { key: "<<NIP>>",                label: "NIP Pejabat",              source: "template" },
  { key: "<<NIP PEJABAT>>",        label: "NIP Pejabat (alt)",        source: "template" },
  { key: "<<KOTA>>",               label: "Kota Surat",               source: "template" },
  { key: "<<TEMBUSAN>>",           label: "Daftar Tembusan",          source: "template" },
  // Otomatis
  { key: "<<TANGGAL>>",            label: "Tanggal Hari Ini",         source: "auto" },
  { key: "<<TANGGAL HARI INI>>",   label: "Tanggal Hari Ini (full)",  source: "auto" },
  { key: "<<TAHUN>>",              label: "Tahun Sekarang",           source: "auto" },
  { key: "<<BULAN>>",              label: "Bulan Sekarang",           source: "auto" },
];

const PLACEHOLDERS = [
  "{{full_name}}",
  "{{request_number}}",
  "{{nim_nik}}",
  "{{institution}}",
  "{{research_title}}",
  "{{research_location}}",
  "{{research_duration}}",
  "{{date}}",
  "{{signer_name}}",
  "{{signer_signature_url}}",
];

const SOURCE_COLORS: Record<string, string> = {
  permit:   "bg-blue-100 text-blue-700 border-blue-200",
  template: "bg-purple-100 text-purple-700 border-purple-200",
  auto:     "bg-green-100 text-green-700 border-green-200",
};

const SOURCE_LABELS: Record<string, string> = {
  permit:   "Data Pemohon",
  template: "Konfigurasi Template",
  auto:     "Otomatis",
};

type FormValues = {
  name: string;
  type: string;
  category: string;
  content: string;
  officialName: string;
  officialPosition: string;
  officialNip: string;
  city: string;
  tembusan: string;
  kepada: string;
};

export default function LetterTemplateForm({
  mode,
  id,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<FormValues>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showDocxVars, setShowDocxVars] = useState(true);
  const [showHtmlVars, setShowHtmlVars] = useState(false);

  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      name:             initial?.name             || "",
      type:             initial?.type             || "research_permit",
      category:         initial?.category         || "surat_izin",
      content:          initial?.content          || "",
      officialName:     initial?.officialName     || "",
      officialPosition: initial?.officialPosition || "",
      officialNip:      initial?.officialNip      || "",
      city:             initial?.city             || "Palangka Raya",
      tembusan:         initial?.tembusan         || "",
      kepada:           initial?.kepada           || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const url = mode === "edit" ? `/api/admin/letter-templates/${id}` : "/api/admin/letter-templates";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await apiRequest(method as any, url, data);
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
    editorRef.current?.insertContent(ph);
    setCopied(ph);
    setTimeout(() => setCopied(null), 1200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const editorInit = useMemo(
    () => ({
      height: 620,
      menubar: false,
      plugins: [
        "advlist", "autolink", "lists", "link",
        "image", "table", "code", "preview", "fullscreen",
        "hr", "wordcount",
      ],
      image_title: true,
      file_picker_types: "image",
      toolbar:
        "undo redo | blocks | bold italic underline | alignleft aligncenter alignright | " +
        "bullist numlist | hr table image link | removeformat | fullscreen preview | code",
      block_formats: "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3",
      content_style: `
        body { font-family: "Times New Roman", serif; font-size: 14px; line-height: 1.6; padding: 32px; }
        hr { border: 0; border-top: 3px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 8px 0 16px; }
        img { max-width: 100%; height: auto; }
      `,
      automatic_uploads: true,
      images_upload_handler: async (blobInfo: any) => {
        const form = new FormData();
        form.append("file", blobInfo.blob(), blobInfo.filename());
        if (mode === "edit" && id) form.append("templateId", id);
        const res = await apiRequest("POST", "/api/admin/letter-templates/upload", form);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const url = json.location || json.url;
        if (!url) throw new Error("Upload response missing url/location");
        return url;
      },
    }),
    [],
  );

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      {/* Nama & Tipe & Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Nama Template *</Label>
          <Input {...register("name", { required: true })} placeholder="Template Izin Penelitian Default" />
        </div>
        <div className="space-y-2">
          <Label>Tipe</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="research_permit">Izin Penelitian</SelectItem>
                  <SelectItem value="general">Umum</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Kategori Surat</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="surat_izin">Surat Izin</SelectItem>
                  <SelectItem value="rekomendasi">Surat Rekomendasi</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Konfigurasi Pejabat Penandatangan */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Konfigurasi Pejabat & Surat</h3>
          <span className="text-xs text-muted-foreground ml-1">— digunakan untuk mengisi variabel otomatis pada DOCX</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Nama Pejabat Penandatangan</Label>
            <Input {...register("officialName")} placeholder="Drs. Budi Santoso, M.Si" />
            <p className="text-xs text-muted-foreground">Digunakan untuk <code className="bg-muted px-1 rounded">{"<<NAMA PEJABAT>>"}</code></p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Jabatan Pejabat</Label>
            <Input {...register("officialPosition")} placeholder="Kepala BAPPERIDA Kalteng" />
            <p className="text-xs text-muted-foreground">Digunakan untuk <code className="bg-muted px-1 rounded">{"<<JABATAN>>"}</code></p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">NIP Pejabat</Label>
            <Input {...register("officialNip")} placeholder="19700101 199503 1 001" />
            <p className="text-xs text-muted-foreground">Digunakan untuk <code className="bg-muted px-1 rounded">{"<<NIP>>"}</code></p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Kota Surat</Label>
            <Input {...register("city")} placeholder="Palangka Raya" />
            <p className="text-xs text-muted-foreground">Digunakan untuk <code className="bg-muted px-1 rounded">{"<<KOTA>>"}</code></p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tembusan</Label>
            <Textarea
              {...register("tembusan")}
              placeholder={"Kepala Dinas Pendidikan\nKetua DPRD Provinsi\nArsip"}
              rows={3}
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">Satu baris = satu penerima. Digunakan untuk <code className="bg-muted px-1 rounded">{"<<TEMBUSAN>>"}</code></p>
          </div>
        </div>
        {/* Kepada — full width, multi-baris */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Kepada (Alamat Surat)</Label>
          <Textarea
            {...register("kepada")}
            placeholder={"Yth. Bapak/Ibu Gubernur Kalimantan Tengah\ndi Palangka Raya"}
            rows={3}
            className="text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Bisa multi-baris — tekan <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Enter</kbd> untuk baris baru.
            Digunakan untuk <code className="bg-muted px-1 rounded">{"<<KEPADA>>"}</code>.
            Jika kosong, otomatis diisi nama pemohon.
          </p>
        </div>
      </div>

      {/* Variabel DOCX */}
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDocxVars(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-amber-800 dark:text-amber-300">Daftar Variabel DOCX</span>
            <Badge variant="secondary" className="text-xs">{"<<VARIABEL>>"}</Badge>
            <span className="text-xs text-muted-foreground">Gunakan di file .docx yang diupload</span>
          </div>
          {showDocxVars ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showDocxVars && (
          <div className="p-4 space-y-3 bg-background">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(SOURCE_LABELS).map(([src, label]) => (
                <span key={src} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${SOURCE_COLORS[src]}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" /> {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DOCX_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => copyToClipboard(v.key)}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono font-semibold">{v.key}</code>
                    <p className="text-xs text-muted-foreground truncate">{v.label}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${SOURCE_COLORS[v.source]}`}>
                      {SOURCE_LABELS[v.source].split(" ")[0]}
                    </span>
                    {copied === v.key
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      : <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    }
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <strong>Cara pakai:</strong> Ketik <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{"<<NAMA PEJABAT>>"}</code> langsung di dalam file .docx Anda. Saat generate, teks tersebut akan diganti otomatis dengan data yang sesuai.
            </p>
          </div>
        )}
      </div>

      {/* Variabel HTML/PDF */}
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHtmlVars(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">Variabel HTML (Editor di bawah)</span>
            <Badge variant="secondary" className="text-xs">{"{{variabel}}"}</Badge>
          </div>
          {showHtmlVars ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showHtmlVars && (
          <div className="p-4 bg-background">
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => insertPlaceholder(ph)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border bg-muted hover:bg-muted/70 font-mono"
                >
                  {copied === ph ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {ph}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Konten HTML (TinyMCE) */}
      <div className="space-y-2">
        <Label>Konten Template HTML</Label>
        <p className="text-xs text-muted-foreground">Template HTML ini digunakan untuk preview dan cetak PDF. Untuk file DOCX, upload file .docx terpisah di halaman detail template.</p>
        <div className="rounded-md border bg-white">
          <Controller
            name="content"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Editor
                apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
                onInit={(_, editor) => (editorRef.current = editor)}
                value={field.value}
                onEditorChange={field.onChange}
                init={editorInit}
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Menyimpan..." : "Simpan Template"}
        </Button>
      </div>
    </form>
  );
}
