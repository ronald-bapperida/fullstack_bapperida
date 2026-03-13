import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import * as mammoth from "mammoth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import {
  FileEdit,
  Plus,
  Upload,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateFile {
  id: string;
  templateId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  type: string | null;
  content: string;
  placeholders: string | null; // JSON array string: ["<<NAMA>>", "<<NIM>>", ...]
  isActive: boolean;
  createdAt: string;
  files?: TemplateFile[]; // included if backend enriches
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mapping placeholder template DOCX → nilai sampel untuk preview */
const SAMPLE_VALUES: Record<string, string> = {
  "NAMA": "Budi Santoso",
  "NIM": "2021001234",
  "TIM SURVEY/PENELITI": "Universitas Palangka Raya",
  "JUDUL PENELITIAN": "Analisis Pengembangan Infrastruktur Daerah Kalimantan Tengah",
  "LOKASI PENELITIAN": "Kota Palangka Raya",
  "NOMOR SURAT": "123/UPR/HK/2026",
  "TANGGAL SURAT": "01 JANUARI 2026",
  "TANDA TANGAN": "Universitas Palangka Raya",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePlaceholders(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Replace <<PLACEHOLDER>> di HTML hasil mammoth dengan nilai sampel */
function applyPreviewSamples(html: string): string {
  let out = html;
  for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
    // Placeholder muncul sebagai teks literal di HTML hasil mammoth
    const pattern = new RegExp(`<<${key}>>`, "gi");
    out = out.replace(
      pattern,
      `<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 3px;font-weight:600;">${value}</span>`
    );
  }
  // Highlight sisa placeholder yang belum terpetakan
  out = out.replace(
    /<<([^>]+)>>/g,
    `<span style="background:#fef3c7;color:#92400e;border-radius:3px;padding:0 3px;font-weight:600;">&lt;&lt;$1&gt;&gt;</span>`
  );
  return out;
}

/** Fetch DOCX → convert via mammoth → return HTML string */
async function docxToHtml(fileUrl: string): Promise<string> {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Gagal mengambil file: ${resp.statusText}`);
  const arrayBuffer = await resp.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPlaceholders, setPreviewPlaceholders] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setName("");
    setFile(null);
    setPreviewPlaceholders([]);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /** Parse placeholder dari DOCX di sisi client sebelum upload */
  const parseDocxPlaceholders = async (f: File) => {
    setParsing(true);
    try {
      const ab = await f.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab });
      const matches = [...html.matchAll(/<<([^>]+)>>/g)].map((m) => `<<${m[1]}>>`);
      setPreviewPlaceholders([...new Set(matches)]);
    } catch {
      setPreviewPlaceholders([]);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = async (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith(".docx")) {
      toast({ title: "Format salah", description: "Hanya file .docx yang diperbolehkan", variant: "destructive" });
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, ""));
    await parseDocxPlaceholders(f);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pilih file terlebih dahulu");
      if (!name.trim()) throw new Error("Nama template wajib diisi");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      const res = await fetch("/api/admin/letter-templates/upload-docx", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template berhasil diupload" });
      reset();
      onSuccess();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Gagal upload", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Template Surat
          </DialogTitle>
          <DialogDescription>
            Upload file .docx dengan placeholder <code className="text-xs">{"<<NAMA>>"}</code>,{" "}
            <code className="text-xs">{"<<JUDUL PENELITIAN>>"}</code>, dll.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-name">Nama Template</Label>
            <Input
              id="tpl-name"
              placeholder="Contoh: Surat Izin Penelitian 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFileChange(f);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            {file ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="truncate max-w-[260px]">{file.name}</span>
                  <button
                    type="button"
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewPlaceholders([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{humanFileSize(file.size)}</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium">Klik atau seret file ke sini</p>
                  <p className="text-xs text-muted-foreground mt-1">Hanya file .docx</p>
                </div>
              </>
            )}
          </div>

          {/* Placeholder preview */}
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Membaca placeholder dari file...
            </div>
          )}

          {!parsing && previewPlaceholders.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                {previewPlaceholders.length} placeholder ditemukan:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previewPlaceholders.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs font-mono">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {!parsing && file && previewPlaceholders.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" />
              Tidak ada placeholder {"<<...>>"} terdeteksi di file ini.
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Batal
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || !name.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengupload...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Upload Template</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  template: Template | null;
  open: boolean;
  onClose: () => void;
}

function PreviewModal({ template, open, onClose }: PreviewModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Ambil file URL dari template
  const { data: files = [] } = useQuery<TemplateFile[]>({
    queryKey: [`/api/admin/letter-templates/${template?.id}/files`],
    enabled: open && !!template?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/letter-templates/${template!.id}/files`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const docxFile = files.find((f) => f.fileUrl.endsWith(".docx"));

  // Load dan convert DOCX ketika modal dibuka
  const loadPreview = useCallback(async (fileUrl: string) => {
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const rawHtml = await docxToHtml(fileUrl);
      const withSamples = applyPreviewSamples(rawHtml);
      setHtml(withSamples);
    } catch (e: any) {
      setError(e.message || "Gagal merender file");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger load ketika file URL tersedia
  const prevFileUrl = useRef<string | null>(null);
  if (open && docxFile && docxFile.fileUrl !== prevFileUrl.current) {
    prevFileUrl.current = docxFile.fileUrl;
    loadPreview(docxFile.fileUrl);
  }
  if (!open && prevFileUrl.current !== null) {
    prevFileUrl.current = null;
  }

  const placeholders = parsePlaceholders(template?.placeholders);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setHtml(null);
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {template?.name ?? "Preview Template"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Placeholder <span className="bg-blue-100 text-blue-700 rounded px-1 text-xs font-mono">diisi data sampel</span>.{" "}
                Placeholder tidak dikenal{" "}
                <span className="bg-amber-100 text-amber-700 rounded px-1 text-xs font-mono">ditandai kuning</span>.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
              className="shrink-0 text-xs"
            >
              {showRaw ? "Tampilkan Preview" : "Tampilkan Raw"}
            </Button>
          </div>

          {placeholders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {placeholders.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs font-mono">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Preview area */}
        <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Merender dokumen...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-destructive text-sm">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
              {docxFile && (
                <Button variant="outline" size="sm" onClick={() => loadPreview(docxFile.fileUrl)}>
                  Coba Lagi
                </Button>
              )}
            </div>
          ) : !docxFile ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 opacity-30" />
              <span>File DOCX tidak ditemukan untuk template ini</span>
            </div>
          ) : !html ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Memuat...
            </div>
          ) : showRaw ? (
            <pre className="p-6 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
              {html}
            </pre>
          ) : (
            // Render HTML hasil mammoth dengan styling surat pemerintah
            <div className="p-8 max-w-4xl mx-auto">
              <div
                className="docx-preview bg-white shadow-sm border p-12 min-h-[600px]"
                style={{ fontFamily: "Times New Roman, serif", fontSize: "12pt", lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <style>{`
                .docx-preview p { margin: 0 0 4px 0; }
                .docx-preview table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                .docx-preview td, .docx-preview th { padding: 4px 8px; vertical-align: top; }
                .docx-preview h1, .docx-preview h2, .docx-preview h3 { font-weight: bold; margin: 8px 0 4px; }
                .docx-preview strong { font-weight: bold; }
              `}</style>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2">
          {docxFile && (
            <Button variant="outline" asChild>
              <a href={docxFile.fileUrl} download={docxFile.fileName}>
                Download File Asli
              </a>
            </Button>
          )}
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LetterTemplatesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], isLoading, error } = useQuery<Template[]>({
    queryKey: ["/api/admin/letter-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/letter-templates");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/letter-templates/${id}`);
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/letter-templates"] });
      toast({ title: "Template dihapus" });
      setDeleteTarget(null);
    },
    onError: (e: any) =>
      toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileEdit className="w-6 h-6" />
            Template Surat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload template .docx dengan placeholder{" "}
            <code className="text-xs bg-muted px-1 rounded">{"<<NAMA>>"}</code>,{" "}
            <code className="text-xs bg-muted px-1 rounded">{"<<JUDUL PENELITIAN>>"}</code>, dll.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4" />
          Upload Template
        </Button>
      </div>

      {/* Error */}
      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-600">
            Gagal memuat template: {(error as any)?.message}
          </CardContent>
        </Card>
      ) : null}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">Belum ada template surat</p>
            <p className="text-xs mt-1 mb-4">Upload file .docx yang sudah berisi placeholder.</p>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Template Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const placeholders = parsePlaceholders(t.placeholders);
            return (
              <Card
                key={t.id}
                className="hover:shadow-sm transition-shadow"
                data-testid={`card-template-${t.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base truncate">{t.name}</CardTitle>
                        <Badge
                          variant={t.isActive ? "default" : "secondary"}
                          className="text-xs shrink-0"
                        >
                          {t.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                        {t.type && t.type !== "research_permit" && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {t.type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Diupload:{" "}
                        {t.createdAt
                          ? format(new Date(t.createdAt), "d MMMM yyyy, HH:mm", { locale: idLocale })
                          : "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewTemplate(t)}
                        data-testid={`button-preview-${t.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(t)}
                        data-testid={`button-delete-${t.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {placeholders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {placeholders.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs font-mono">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Tidak ada placeholder terdeteksi — cek ulang format {"<<PLACEHOLDER>>"} di file.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["/api/admin/letter-templates"] })
        }
      />

      <PreviewModal
        template={previewTemplate}
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Template?</DialogTitle>
            <DialogDescription>
              Template <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menghapus...</>
              ) : (
                "Ya, Hapus"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}