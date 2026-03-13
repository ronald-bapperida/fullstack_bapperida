import { useMemo, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import * as mammoth from "mammoth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  FileCheck,
  Send,
  ExternalLink,
  Eye,
  Download,
  Loader2,
  BookOpen,
  AlertCircle,
  FileDown,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterTemplate {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  placeholders: string | null; // JSON: ["<<NAMA>>", ...]
  createdAt: string;
}

interface TemplateFile {
  id: string;
  templateId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  submitted: "Diajukan",
  in_review: "Dalam Review",
  revision_requested: "Perlu Revisi",
  approved: "Disetujui",
  generated_letter: "Surat Dibuat",
  sent: "Terkirim",
  rejected: "Ditolak",
};

const STATUS_ICONS: Record<string, any> = {
  submitted: Clock,
  in_review: Clock,
  revision_requested: FileText,
  approved: CheckCircle,
  generated_letter: FileCheck,
  sent: Send,
  rejected: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-muted-foreground",
  in_review: "text-chart-3",
  revision_requested: "text-chart-2",
  approved: "text-chart-1",
  generated_letter: "text-primary",
  sent: "text-chart-4",
  rejected: "text-destructive",
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Buat map replacement dari data permit ke placeholder template.
 * Placeholder di XML: &lt;&lt;NAMA&gt;&gt; → setelah mammoth jadi teks: <<NAMA>>
 */
function buildReplacementsFromPermit(permit: any): Record<string, string> {
  const formatDate = (d: any): string => {
    if (!d) return "-";
    return new Date(d)
      .toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      .toUpperCase();
  };

  return {
    "NAMA": permit.fullName ?? "-",
    "NIM": permit.nimNik ?? "-",
    "TIM SURVEY/PENELITI": permit.institution ?? "-",
    "JUDUL PENELITIAN": permit.researchTitle ?? "-",
    "LOKASI PENELITIAN": permit.researchLocation ?? "-",
    "NOMOR SURAT": permit.introLetterNumber ?? "-",
    "TANGGAL SURAT": formatDate(permit.introLetterDate),
    "TANDA TANGAN": permit.workUnit || permit.institution || "-",
  };
}

/**
 * Apply replacements ke HTML hasil mammoth.
 * Placeholder muncul sebagai teks literal <<NAMA>> setelah konversi.
 */
function applyReplacementsToHtml(
  html: string,
  replacements: Record<string, string>
): string {
  let out = html;
  for (const [key, value] of Object.entries(replacements)) {
    // Ganti placeholder dengan highlight biru (data nyata)
    const escaped = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    out = out.replace(
      new RegExp(`<<${key}>>`, "gi"),
      `<mark style="background:#dbeafe;color:#1e40af;border-radius:2px;padding:0 2px;font-weight:600;">${escaped}</mark>`
    );
  }
  // Highlight sisa placeholder yang belum terpetakan (kuning)
  out = out.replace(
    /<<([^>]+)>>/g,
    `<mark style="background:#fef9c3;color:#713f12;border-radius:2px;padding:0 2px;">&lt;&lt;$1&gt;&gt;</mark>`
  );
  return out;
}

/** Fetch DOCX dari URL → convert via mammoth → return raw HTML */
async function docxUrlToHtml(fileUrl: string): Promise<string> {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Gagal mengambil file template: ${resp.statusText}`);
  const arrayBuffer = await resp.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground col-span-1">{label}</span>
      <span className="text-sm font-medium col-span-2">{value || "-"}</span>
    </div>
  );
}

function FileLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return <InfoRow label={label} value="-" />;
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground col-span-1">{label}</span>
      <div className="col-span-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary flex items-center gap-1 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Lihat File
        </a>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  permit: any;
  templateId: string | null;
}

function PreviewModal({ open, onClose, permit, templateId }: PreviewModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Fetch files dari template yang dipilih
  const { data: files = [] } = useQuery<TemplateFile[]>({
    queryKey: [`/api/admin/letter-templates/${templateId}/files`],
    enabled: open && !!templateId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/letter-templates/${templateId}/files`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const docxFile = files.find((f) => f.fileUrl.endsWith(".docx"));

  const loadPreview = useCallback(
    async (fileUrl: string) => {
      if (loadedFor.current === fileUrl) return;
      loadedFor.current = fileUrl;
      setLoading(true);
      setError(null);
      setHtml(null);
      try {
        const rawHtml = await docxUrlToHtml(fileUrl);
        const replacements = buildReplacementsFromPermit(permit);
        const applied = applyReplacementsToHtml(rawHtml, replacements);
        setHtml(applied);
      } catch (e: any) {
        setError(e.message || "Gagal merender dokumen");
        loadedFor.current = null;
      } finally {
        setLoading(false);
      }
    },
    [permit]
  );

  // Trigger load saat file tersedia
  if (open && docxFile && loadedFor.current !== docxFile.fileUrl) {
    loadPreview(docxFile.fileUrl);
  }
  if (!open && loadedFor.current !== null) {
    loadedFor.current = null;
    // reset state hanya sekali lewat effect di bawah
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setHtml(null);
          setError(null);
          loadedFor.current = null;
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" />
            Preview Surat Izin — {permit?.requestNumber}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Data permit sudah dimasukkan ke dalam template.{" "}
            <span className="inline-block bg-blue-100 text-blue-700 rounded px-1 font-mono">
              Highlight biru
            </span>{" "}
            = data real.{" "}
            <span className="inline-block bg-yellow-100 text-yellow-700 rounded px-1 font-mono">
              Highlight kuning
            </span>{" "}
            = placeholder belum terpetakan.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
          {!docxFile && !loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 opacity-30" />
              <span>File DOCX tidak ditemukan untuk template ini</span>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Merender dokumen dengan data permit...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-destructive text-sm">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
              {docxFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadedFor.current = null;
                    loadPreview(docxFile.fileUrl);
                  }}
                >
                  Coba Lagi
                </Button>
              )}
            </div>
          ) : html ? (
            <div className="p-8 max-w-4xl mx-auto">
              <div
                className="bg-white shadow border p-12 min-h-[700px]"
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: "12pt",
                  lineHeight: 1.6,
                  color: "#1a1a1a",
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {/* Style for mammoth output */}
              <style>{`
                .bg-white p { margin: 0 0 4px; }
                .bg-white table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                .bg-white td, .bg-white th { padding: 3px 6px; vertical-align: top; }
                .bg-white strong, .bg-white b { font-weight: 700; }
                .bg-white em, .bg-white i { font-style: italic; }
                .bg-white h1, .bg-white h2 { font-weight: 700; margin: 8px 0 4px; }
              `}</style>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Template di-render menggunakan mammoth.js — format mungkin sedikit berbeda dari aslinya.
          </div>
          <div className="flex gap-2">
            {docxFile && (
              <Button variant="outline" size="sm" asChild>
                <a href={docxFile.fileUrl} download={docxFile.fileName}>
                  <FileDown className="w-4 h-4 mr-1.5" />
                  Unduh Template Asli
                </a>
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generate Card ────────────────────────────────────────────────────────────

interface GenerateCardProps {
  permit: any;
  permitId: string;
}

function GenerateCard({ permit, permitId }: GenerateCardProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"docx" | "pdf">("docx");

  // Fetch list templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<LetterTemplate[]>({
    queryKey: ["/api/admin/letter-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/letter-templates");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const activeTemplates = templates.filter((t) => t.isActive);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Generate DOCX mutation
  const generateMutation = useMutation({
    mutationFn: async (format: "docx" | "pdf") => {
      if (!selectedTemplateId) throw new Error("Pilih template terlebih dahulu");

      const res = await fetch(
        `/api/admin/permits/${permitId}/generate-letter-docx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ templateId: selectedTemplateId }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      return { blob: await res.blob(), format };
    },
    onSuccess: ({ blob, format }) => {
      const safeName = (permit?.requestNumber ?? "surat-izin")
        .replace(/[/\\]/g, "-")
        .replace(/\s+/g, "-");
      const ext = format === "pdf" ? "pdf" : "docx";
      downloadBlob(blob, `${safeName}.${ext}`);

      toast({
        title: "Surat berhasil digenerate",
        description: "File sudah didownload ke komputer Anda",
      });

      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) =>
      toast({ title: "Gagal generate", description: e.message, variant: "destructive" }),
  });

  const placeholders = parsePlaceholders(selectedTemplate?.placeholders);

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Generate Surat Izin Penelitian
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Template selector */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-select">Pilih Template Surat</Label>

            {templatesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : activeTemplates.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Belum ada template aktif. Upload template di halaman{" "}
                <a href="/letter-templates" className="underline font-medium">
                  Template Surat
                </a>
                .
              </div>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="-- Pilih template --" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected template info */}
          {selectedTemplate && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{selectedTemplate.name}</span>
                <Badge variant={selectedTemplate.isActive ? "default" : "secondary"} className="text-xs">
                  {selectedTemplate.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              {placeholders.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {placeholders.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs font-mono">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Placeholder tidak terdeteksi di template ini.
                </p>
              )}
            </div>
          )}

          {/* Generated letter link (jika sudah ada) */}
          {permit?.generatedLetter?.fileUrl && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 font-medium">Surat sudah pernah digenerate:</span>
              <a
                href={permit.generatedLetter.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline ml-auto"
              >
                <ExternalLink className="w-3 h-3" />
                Buka file tersimpan
              </a>
            </div>
          )}

          {/* Actions */}
          {selectedTemplateId ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {/* Preview */}
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview Surat
              </Button>

              {/* Download */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Select
                  value={downloadFormat}
                  onValueChange={(v: any) => setDownloadFormat(v)}
                >
                  <SelectTrigger className="w-[110px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docx">DOCX</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => generateMutation.mutate(downloadFormat)}
                  disabled={generateMutation.isPending}
                  className="gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate &amp; Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
              Pilih template terlebih dahulu untuk melanjutkan
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview modal */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        permit={permit}
        templateId={selectedTemplateId || null}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermitDetailPage() {
  const { id: permitId } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");

  const { data: permit, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/permits/${permitId}`],
  });

  const StatusIcon = useMemo(
    () => STATUS_ICONS[permit?.status] || Clock,
    [permit?.status]
  );

  const nextStatuses = useMemo<string[]>(() => {
    if (!permit?.status) return [];
    return (
      ({
        submitted: ["in_review", "rejected"],
        in_review: ["revision_requested", "approved", "rejected"],
        revision_requested: ["in_review", "rejected"],
        approved: ["generated_letter"],
        generated_letter: ["sent"],
        sent: [],
        rejected: [],
      } as Record<string, string[]>)[permit.status] ?? []
    );
  }, [permit?.status]);

  const statusMutation = useMutation({
    mutationFn: async (data: { status: string; note: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/permits/${permitId}/status`,
        data
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
      toast({ title: "Status diperbarui" });
      setNewStatus("");
      setNote("");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Loading / not found ──────────────────────────────────────────────────────
  if (isLoading)
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );

  if (!permit)
    return (
      <div className="p-6 text-muted-foreground">Permohonan tidak ditemukan</div>
    );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLoc("/permits")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{permit.requestNumber}</h1>
          <p className="text-muted-foreground text-sm">
            {permit.fullName} · {permit.institution}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="gap-1.5">
            <StatusIcon
              className={`w-3.5 h-3.5 ${STATUS_COLORS[permit.status] ?? "text-muted-foreground"}`}
            />
            {STATUS_LABELS[permit.status] || permit.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left / main column ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Data Pemohon */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Pemohon</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Nama Lengkap" value={permit.fullName} />
              <InfoRow label="Email" value={permit.email} />
              <InfoRow label="NIM/NIK" value={permit.nimNik} />
              <InfoRow label="Tempat Lahir" value={permit.birthPlace} />
              <InfoRow label="No. WA" value={permit.phoneWa} />
              <InfoRow label="Kewarganegaraan" value={permit.citizenship} />
              <InfoRow label="Unit Kerja/Tim" value={permit.workUnit} />
              <InfoRow label="Asal Lembaga" value={permit.institution} />
            </CardContent>
          </Card>

          {/* Data Penelitian */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Penelitian</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Judul Penelitian" value={permit.researchTitle} />
              <InfoRow label="Lokasi Penelitian" value={permit.researchLocation} />
              <InfoRow label="Durasi Penelitian" value={permit.researchDuration} />
              <InfoRow label="Jabatan Penanda Tangan" value={permit.signerPosition} />
              <InfoRow label="No. Surat Pengantar" value={permit.introLetterNumber} />
              <InfoRow
                label="Tanggal Surat"
                value={
                  permit.introLetterDate
                    ? format(new Date(permit.introLetterDate), "d MMMM yyyy", {
                        locale: localeId,
                      })
                    : "-"
                }
              />
            </CardContent>
          </Card>

          {/* Dokumen Lampiran */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dokumen Lampiran</CardTitle>
            </CardHeader>
            <CardContent>
              <FileLink label="Kartu Identitas" url={permit.fileIdentity} />
              <FileLink label="Surat Pengantar" url={permit.fileIntroLetter} />
              <FileLink label="Proposal Penelitian" url={permit.fileProposal} />
              <FileLink label="Bukti Follow Sosmed" url={permit.fileSocialMedia} />
              <FileLink label="Bukti Isi Survei" url={permit.fileSurvey} />
            </CardContent>
          </Card>

          {/* Generate Surat — pilih dari DB template */}
          <GenerateCard permit={permit} permitId={permitId} />
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Update Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {nextStatuses.length > 0 ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>Status Baru</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger data-testid="select-new-status">
                        <SelectValue placeholder="Pilih status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {nextStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s] || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Catatan (opsional)</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Tambahkan catatan untuk pemohon..."
                    />
                  </div>

                  <Button
                    onClick={() =>
                      statusMutation.mutate({ status: newStatus, note })
                    }
                    disabled={!newStatus || statusMutation.isPending}
                    data-testid="button-update-status"
                  >
                    {statusMutation.isPending ? "Memproses..." : "Update Status"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Status sudah final
                </p>
              )}
            </CardContent>
          </Card>

          {/* Riwayat Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Status</CardTitle>
            </CardHeader>
            <CardContent>
              {permit.history?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {permit.history.map((h: any, i: number) => {
                    const Icon = STATUS_ICONS[h.toStatus] || Clock;
                    return (
                      <div key={i} className="flex gap-3">
                        <Icon
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            STATUS_COLORS[h.toStatus] || "text-muted-foreground"
                          }`}
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {STATUS_LABELS[h.toStatus] || h.toStatus}
                          </span>
                          {h.note && (
                            <span className="text-xs text-muted-foreground">
                              {h.note}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(h.createdAt), "d MMM yyyy HH:mm", {
                              locale: localeId,
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada riwayat
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}