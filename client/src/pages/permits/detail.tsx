import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  ArrowLeft, FileText, Clock, CheckCircle, XCircle, FileCheck, Send,
  ExternalLink, Eye, Download, Loader2, AlertCircle, Upload, Mail,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterTemplate {
  id: string; name: string; type: string | null; isActive: boolean; placeholders: string | null; createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  submitted:         "Diajukan",
  in_review:         "Dalam Review",
  revision_requested:"Perlu Revisi",
  approved:          "Disetujui",
  generated_letter:  "Surat Dibuat",
  sent:              "Terkirim",
  rejected:          "Ditolak",
};

const STATUS_ICONS: Record<string, any> = {
  submitted: Clock, in_review: Clock, revision_requested: FileText,
  approved: CheckCircle, generated_letter: FileCheck, sent: Send, rejected: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-muted-foreground", in_review: "text-chart-3",
  revision_requested: "text-chart-2", approved: "text-chart-1",
  generated_letter: "text-primary", sent: "text-chart-4", rejected: "text-destructive",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePlaceholders(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
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
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-sm text-primary flex items-center gap-1 hover:underline">
          <ExternalLink className="w-3 h-3" /> Lihat File
        </a>
      </div>
    </div>
  );
}

// ─── Admin Letter Fields Card ─────────────────────────────────────────────────

interface AdminLetterFields {
  issuedLetterNumber: string;
  issuedLetterDate: string;
  researchStartDate: string;
  researchEndDate: string;
}

const LETTER_NUMBER_PREFIX = "072/";
const LETTER_NUMBER_SUFFIX = "/1/I/Bapprida";

function AdminLetterFieldsCard({
  fields,
  onChange,
  permit,
}: {
  fields: AdminLetterFields;
  onChange: (fields: AdminLetterFields) => void;
  permit: any;
}) {
  const set = (key: keyof AdminLetterFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...fields, [key]: e.target.value });

  const fullLetterNumber = fields.issuedLetterNumber
    ? `${LETTER_NUMBER_PREFIX}${fields.issuedLetterNumber}${LETTER_NUMBER_SUFFIX}`
    : "-";

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-600" />
          Data Surat Izin (Diisi Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Read-only fields from applicant */}
        <div className="rounded-md bg-muted/40 border px-3 py-2.5 flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground font-medium">Data dari Pemohon (tidak dapat diubah)</p>
          <InfoRow label="No. Surat Pengantar" value={permit.introLetterNumber} />
          <InfoRow label="Pejabat Surat Pengantar" value={permit.signerPosition} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs">Nomor Surat Izin <span className="text-muted-foreground">(isi bagian tengah saja)</span></Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{LETTER_NUMBER_PREFIX}</span>
              <Input
                value={fields.issuedLetterNumber}
                onChange={set("issuedLetterNumber")}
                placeholder="001"
                className="flex-1"
                data-testid="input-issued-letter-number"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{LETTER_NUMBER_SUFFIX}</span>
            </div>
            {fields.issuedLetterNumber && (
              <p className="text-xs text-muted-foreground">Hasil: <span className="font-mono font-medium">{fullLetterNumber}</span></p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tanggal Surat Izin Ditetapkan</Label>
            <Input
              type="date"
              value={fields.issuedLetterDate}
              onChange={set("issuedLetterDate")}
              data-testid="input-issued-letter-date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tanggal Mulai Penelitian</Label>
            <Input
              type="date"
              value={fields.researchStartDate}
              onChange={set("researchStartDate")}
              data-testid="input-research-start-date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tanggal Selesai Penelitian</Label>
            <Input
              type="date"
              value={fields.researchEndDate}
              onChange={set("researchEndDate")}
              data-testid="input-research-end-date"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Generate Card ────────────────────────────────────────────────────────────

function GenerateCard({
  permit,
  permitId,
  adminLetterFields,
}: {
  permit: any;
  permitId: string;
  adminLetterFields: AdminLetterFields;
}) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

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

  // Build full letter number from middle part + static prefix/suffix
  const fullLetterNumber = adminLetterFields.issuedLetterNumber
    ? `${LETTER_NUMBER_PREFIX}${adminLetterFields.issuedLetterNumber}${LETTER_NUMBER_SUFFIX}`
    : "";

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template terlebih dahulu");
      // Simpan data surat admin sebelum generate (kirim nomor surat lengkap)
      await apiRequest("PATCH", `/api/admin/permits/${permitId}/detail`, {
        ...adminLetterFields,
        issuedLetterNumber: fullLetterNumber || null,
      });
      const res = await fetch(`/api/admin/permits/${permitId}/generate-letter-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ templateId: selectedTemplateId, saveOnly: "true" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(async () => ({ error: await res.text() }));
        throw new Error(err.error || "Gagal generate");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Surat berhasil digenerate dan disimpan" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) => toast({ title: "Gagal generate", description: e.message, variant: "destructive" }),
  });

  const downloadDocxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template terlebih dahulu");
      // Simpan data surat admin dulu
      await apiRequest("PATCH", `/api/admin/permits/${permitId}/detail`, {
        ...adminLetterFields,
        issuedLetterNumber: fullLetterNumber || null,
      });
      const res = await fetch(`/api/admin/permits/${permitId}/generate-letter-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const filename = disp.match(/filename="([^"]+)"/)?.[1] || "BAPPERIDA.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "DOCX berhasil didownload" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
    },
    onError: (e: any) => toast({ title: "Gagal download", description: e.message, variant: "destructive" }),
  });

  const hasLetter = !!permit?.generatedLetter?.fileUrl;

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
          <Label htmlFor="template-select">Pilih Template Surat <span className="text-destructive">*</span></Label>
          {templatesLoading ? <Skeleton className="h-10 w-full" /> :
            activeTemplates.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Belum ada template aktif. Upload template di halaman{" "}
                <a href="/letter-templates" className="underline font-medium">Template Surat</a>.
              </div>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger id="template-select"><SelectValue placeholder="-- Pilih template --" /></SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
            {placeholders.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs font-mono">{p}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Existing generated letter */}
        {hasLetter && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2.5">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 font-medium">Surat sudah digenerate.</span>
          </div>
        )}

        {/* Action buttons */}
        {!selectedTemplateId ? (
          <div className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
            Pilih template terlebih dahulu untuk melanjutkan
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
            <Button
              variant="secondary"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || downloadDocxMutation.isPending}
              className="gap-2"
            >
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Generate & Simpan (PDF)
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadDocxMutation.mutate()}
              disabled={downloadDocxMutation.isPending || generateMutation.isPending}
              className="gap-2"
            >
              {downloadDocxMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download DOCX
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Upload Surat Card (terpisah) ─────────────────────────────────────────────

function UploadSuratCard({ permit, permitId }: { permit: any; permitId: string }) {
  const { toast } = useToast();
  const [overwriteFile, setOverwriteFile] = useState<File | null>(null);

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
    onError: (e: any) => toast({ title: "Gagal upload", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload / Timpa Surat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Upload file surat untuk mengganti atau menambahkan berkas. Digunakan jika berkas bermasalah dan perlu penggantian manual.
          Riwayat akan mencatat berkas ini sebagai <strong>upload manual (bukan dari generate template)</strong>.
          Format: <strong>PDF atau DOCX</strong>, Maks. 10 MB. Nama file otomatis disesuaikan dengan konvensi penamaan surat.
        </p>
        <div className="flex items-center gap-2">
          <Input type="file" accept=".pdf,.docx"
            onChange={(e) => setOverwriteFile(e.target.files?.[0] || null)} className="flex-1" />
          <Button onClick={() => overwriteMutation.mutate()} disabled={!overwriteFile || overwriteMutation.isPending}
            variant="outline" className="gap-2 shrink-0">
            {overwriteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Letter Action Buttons (top right) ───────────────────────────────────────

function LetterActionButtons({ permit, permitId }: { permit: any; permitId: string }) {
  const { toast } = useToast();
  const hasLetter = !!permit?.generatedLetter?.fileUrl;

  const sendLetterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/permits/${permitId}/send-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Surat berhasil dikirim ke email pemohon", description: `Email: ${permit.email}` });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
    },
    onError: (e: any) => toast({ title: "Gagal kirim surat", description: e.message, variant: "destructive" }),
  });

  if (!hasLetter) return null;

  const previewUrl = permit.generatedLetter?.pdfFileUrl || permit.generatedLetter?.fileUrl;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="w-3.5 h-3.5" />
                Preview
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Buka file surat tersimpan</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={permit.generatedLetter.fileUrl} download>
                <Download className="w-3.5 h-3.5" /> Download DOCX
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download file surat</TooltipContent>
        </Tooltip>

        {permit.status === "generated_letter" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => sendLetterMutation.mutate()} disabled={sendLetterMutation.isPending} className="gap-2">
                {sendLetterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Kirim ke Email
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kirim surat ke email pemohon dan ubah status ke Terkirim</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermitDetailPage() {
  const { id: permitId } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");

  const [adminLetterFields, setAdminLetterFields] = useState<AdminLetterFields>({
    issuedLetterNumber: "",
    issuedLetterDate: "",
    researchStartDate: "",
    researchEndDate: "",
  });
  const [letterFieldsInitialized, setLetterFieldsInitialized] = useState(false);

  const { data: permit, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/permits/${permitId}`],
  });

  // Initialize admin letter fields from permit data once it loads
  useEffect(() => {
    if (permit && !letterFieldsInitialized) {
      // issuedLetterNumber stored as full string — extract just the middle part
      let midNumber = permit.issuedLetterNumber || "";
      if (midNumber.includes(LETTER_NUMBER_PREFIX) && midNumber.includes(LETTER_NUMBER_SUFFIX)) {
        midNumber = midNumber
          .replace(LETTER_NUMBER_PREFIX, "")
          .replace(LETTER_NUMBER_SUFFIX, "");
      }
      setAdminLetterFields({
        issuedLetterNumber: midNumber,
        issuedLetterDate: permit.issuedLetterDate
          ? format(new Date(permit.issuedLetterDate), "yyyy-MM-dd")
          : "",
        researchStartDate: permit.researchStartDate
          ? format(new Date(permit.researchStartDate), "yyyy-MM-dd")
          : "",
        researchEndDate: permit.researchEndDate
          ? format(new Date(permit.researchEndDate), "yyyy-MM-dd")
          : "",
      });
      setLetterFieldsInitialized(true);
    }
  }, [permit, letterFieldsInitialized]);

  const StatusIcon = useMemo(() => STATUS_ICONS[permit?.status] || Clock, [permit?.status]);

  const nextStatuses = useMemo<string[]>(() => {
    if (!permit?.status) return [];
    return (({
      submitted: ["in_review", "rejected"],
      in_review: ["revision_requested", "approved", "rejected"],
      revision_requested: ["in_review", "rejected"],
      approved: ["generated_letter"],
      generated_letter: [],
      sent: [],
      rejected: [],
    } as Record<string, string[]>)[permit.status] ?? []);
  }, [permit?.status]);

  const statusMutation = useMutation({
    mutationFn: async (data: { status: string; note: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/permits/${permitId}/status`, data);
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading)
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-64 w-full" /></div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );

  if (!permit) return <div className="p-6 text-muted-foreground">Permohonan tidak ditemukan</div>;

  const hasLetter = !!permit?.generatedLetter?.fileUrl;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLoc("/permits")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{permit.requestNumber}</h1>
          <p className="text-muted-foreground text-sm">{permit.fullName} · {permit.institution}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Letter action buttons (visible once surat already generated) */}
          {hasLetter && <LetterActionButtons permit={permit} permitId={permitId} />}
          <Badge variant="outline" className="gap-1.5">
            <StatusIcon className={`w-3.5 h-3.5 ${STATUS_COLORS[permit.status] ?? "text-muted-foreground"}`} />
            {STATUS_LABELS[permit.status] || permit.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left / main column ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Data Pemohon</CardTitle></CardHeader>
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

          <Card>
            <CardHeader><CardTitle className="text-base">Data Penelitian</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Judul Penelitian" value={permit.researchTitle} />
              <InfoRow label="Lokasi Penelitian" value={permit.researchLocation} />
              <InfoRow label="Durasi Penelitian" value={permit.researchDuration} />
              <InfoRow label="Jabatan Penanda Tangan" value={permit.signerPosition} />
              <InfoRow label="No. Surat Pengantar" value={permit.introLetterNumber} />
              <InfoRow
                label="Tanggal Surat"
                value={permit.introLetterDate ? format(new Date(permit.introLetterDate), "d MMMM yyyy", { locale: localeId }) : "-"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Dokumen Lampiran</CardTitle></CardHeader>
            <CardContent>
              <FileLink label="Kartu Identitas" url={permit.fileIdentity} />
              <FileLink label="Surat Pengantar" url={permit.fileIntroLetter} />
              <FileLink label="Proposal Penelitian" url={permit.fileProposal} />
              <FileLink label="Bukti Follow Sosmed" url={permit.fileSocialMedia} />
              <FileLink label="Bukti Isi Survei" url={permit.fileSurvey} />
            </CardContent>
          </Card>

          {/* Generate Surat — hanya tampil jika belum sent */}
          {permit.status !== "sent" && (
            <GenerateCard permit={permit} permitId={permitId} adminLetterFields={adminLetterFields} />
          )}

          {/* Upload / Timpa Surat — selalu tampil sebagai card terpisah */}
          <UploadSuratCard permit={permit} permitId={permitId} />
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-6">
          {/* Update Status */}
          <Card>
            <CardHeader><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
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
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Catatan (opsional)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tambahkan catatan untuk pemohon..." />
                  </div>
                  <Button
                    onClick={() => statusMutation.mutate({ status: newStatus, note })}
                    disabled={!newStatus || statusMutation.isPending}
                    data-testid="button-update-status"
                  >
                    {statusMutation.isPending ? "Memproses..." : "Update Status"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Status sudah final</p>
              )}
            </CardContent>
          </Card>

          {/* Admin Fields: Data Surat Izin */}
          <AdminLetterFieldsCard fields={adminLetterFields} onChange={setAdminLetterFields} permit={permit} />

          {/* Riwayat Status */}
          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Status</CardTitle></CardHeader>
            <CardContent>
              {permit.history?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {permit.history.map((h: any, i: number) => {
                    const Icon = STATUS_ICONS[h.toStatus] || Clock;
                    const isManualUpload = h.note?.includes("upload manual");
                    return (
                      <div key={i} className="flex gap-3">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS_COLORS[h.toStatus] || "text-muted-foreground"}`} />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{STATUS_LABELS[h.toStatus] || h.toStatus}</span>
                            {isManualUpload && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700">
                                Upload Manual
                              </Badge>
                            )}
                          </div>
                          {h.note && <span className="text-xs text-muted-foreground">{h.note}</span>}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(h.createdAt), "d MMM yyyy HH:mm", { locale: localeId })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada riwayat</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
