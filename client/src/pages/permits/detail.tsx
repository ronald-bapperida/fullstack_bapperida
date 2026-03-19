import { useMemo, useState, useRef } from "react";
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
import { Input } from "@/components/ui/input";
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
  AlertCircle,
  Upload,
  RefreshCw,
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
  placeholders: string | null;
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

function applyReplacementsToHtml(
  html: string,
  replacements: Record<string, string>
): string {
  let out = html;
  for (const [key, value] of Object.entries(replacements)) {
    const escaped = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    out = out.replace(
      new RegExp(`<<${key}>>`, "gi"),
      `<mark style="background:#dbeafe;color:#1e40af;border-radius:2px;padding:0 2px;font-weight:600;">${escaped}</mark>`
    );
  }
  out = out.replace(
    /<<([^>]+)>>/g,
    `<mark style="background:#fef9c3;color:#713f12;border-radius:2px;padding:0 2px;">&lt;&lt;$1&gt;&gt;</mark>`
  );
  return out;
}

async function docxUrlToHtml(fileUrl: string): Promise<string> {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Gagal mengambil file template: ${resp.statusText}`);
  const arrayBuffer = await resp.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

async function openPreviewInNewTab(permit: any, templateId: string) {
  // Fetch template files
  const res = await apiRequest("GET", `/api/admin/letter-templates/${templateId}/files`);
  if (!res.ok) throw new Error("Gagal mengambil file template");
  const files: TemplateFile[] = await res.json();
  const docxFile = files.find((f) => f.fileUrl.endsWith(".docx"));
  if (!docxFile) throw new Error("File DOCX tidak ditemukan untuk template ini");

  const rawHtml = await docxUrlToHtml(docxFile.fileUrl);
  const replacements = buildReplacementsFromPermit(permit);
  const filledHtml = applyReplacementsToHtml(rawHtml, replacements);

  const win = window.open("", "_blank");
  if (!win) throw new Error("Browser memblokir popup. Izinkan popup untuk halaman ini.");

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Preview Surat — ${permit.requestNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #e5e7eb;
      margin: 0;
      padding: 24px 16px;
    }
    .legend {
      max-width: 21cm;
      margin: 0 auto 12px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .paper {
      background: white;
      max-width: 21cm;
      margin: 0 auto;
      padding: 2.5cm 3cm;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      min-height: 29.7cm;
    }
    p { margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    td, th { padding: 3px 6px; vertical-align: top; }
    strong, b { font-weight: 700; }
    em, i { font-style: italic; }
    h1, h2, h3 { font-weight: 700; margin: 8px 0 4px; }
    @media print {
      body { background: white; padding: 0; }
      .legend { display: none; }
      .paper { box-shadow: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="legend">
    <strong>Keterangan:</strong>
    <span><mark style="background:#dbeafe;color:#1e40af;padding:0 4px;border-radius:2px;">Biru</mark> = Data pemohon</span>
    <span><mark style="background:#fef9c3;color:#713f12;padding:0 4px;border-radius:2px;">Kuning</mark> = Placeholder belum terpetakan</span>
    <button onclick="window.print()" style="margin-left:auto;padding:4px 12px;cursor:pointer;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;font-family:Arial,sans-serif;">Cetak / Print</button>
  </div>
  <div class="paper">${filledHtml}</div>
</body>
</html>`);
  win.document.close();
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

// ─── Generate Card ────────────────────────────────────────────────────────────

interface GenerateCardProps {
  permit: any;
  permitId: string;
}

function GenerateCard({ permit, permitId }: GenerateCardProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [overwriteFile, setOverwriteFile] = useState<File | null>(null);

  const hasLetter = !!permit?.generatedLetter?.fileUrl;

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
  const placeholders = parsePlaceholders(selectedTemplate?.placeholders);

  // Generate + Save (no download)
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template terlebih dahulu");
      const res = await fetch(`/api/admin/permits/${permitId}/generate-letter-docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ templateId: selectedTemplateId, saveOnly: "true" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Surat berhasil digenerate dan disimpan" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) =>
      toast({ title: "Gagal generate", description: e.message, variant: "destructive" }),
  });

  // Generate + Download
  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template terlebih dahulu");
      const res = await fetch(`/api/admin/permits/${permitId}/generate-letter-docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.blob();
    },
    onSuccess: (blob) => {
      const safeName = (permit?.requestNumber ?? "surat-izin")
        .replace(/[/\\]/g, "-")
        .replace(/\s+/g, "-");
      downloadBlob(blob, `${safeName}.docx`);
      toast({ title: "Surat berhasil didownload" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) =>
      toast({ title: "Gagal download", description: e.message, variant: "destructive" }),
  });

  // Upload overwrite
  const overwriteMutation = useMutation({
    mutationFn: async () => {
      if (!overwriteFile) throw new Error("Pilih file terlebih dahulu");
      const fd = new FormData();
      fd.append("file", overwriteFile);
      const res = await fetch(`/api/admin/permits/${permitId}/upload-generated-letter`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Surat berhasil diperbarui" });
      setOverwriteFile(null);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) =>
      toast({ title: "Gagal upload", description: e.message, variant: "destructive" }),
  });

  async function handlePreview() {
    if (!selectedTemplateId) {
      toast({ title: "Pilih template terlebih dahulu", variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    try {
      await openPreviewInNewTab(permit, selectedTemplateId);
    } catch (e: any) {
      toast({ title: "Gagal preview", description: e.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
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
          <Label htmlFor="template-select">
            Pilih Template Surat <span className="text-destructive">*</span>
          </Label>

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
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
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
              <p className="text-xs text-muted-foreground">Placeholder tidak terdeteksi di template ini.</p>
            )}
          </div>
        )}

        {/* Existing generated letter */}
        {hasLetter && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2.5">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 font-medium">Surat sudah digenerate:</span>
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

        {/* Action buttons */}
        {!selectedTemplateId ? (
          <div className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
            Pilih template terlebih dahulu untuk melanjutkan
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
            {/* Preview */}
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewLoading}
              className="gap-2"
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Preview (Tab Baru)
            </Button>

            {/* Generate (save only) */}
            <Button
              variant="secondary"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="gap-2"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              Generate & Simpan
            </Button>

            {/* Download */}
            <Button
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
              className="gap-2 ml-auto"
            >
              {downloadMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download DOCX
            </Button>
          </div>
        )}

        {/* Download existing (if generated) */}
        {hasLetter && !selectedTemplateId && (
          <div className="flex gap-2 pt-1 border-t">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={permit.generatedLetter.fileUrl} download>
                <Download className="w-4 h-4" />
                Download Surat Tersimpan
              </a>
            </Button>
          </div>
        )}

        {/* Upload / Overwrite section (if letter already generated) */}
        {hasLetter && (
          <div className="flex flex-col gap-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Upload / Timpa Surat</span>
              <span className="text-xs text-muted-foreground">(maks. 5 MB)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload file baru untuk mengganti surat yang sudah digenerate. Format: PDF, DOCX, JPG, PNG.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setOverwriteFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Button
                onClick={() => overwriteMutation.mutate()}
                disabled={!overwriteFile || overwriteMutation.isPending}
                variant="outline"
                className="gap-2 shrink-0"
              >
                {overwriteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

          {/* Generate Surat */}
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
