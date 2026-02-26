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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

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
          className="text-sm text-primary flex items-center gap-1 hover-elevate"
        >
          <ExternalLink className="w-3 h-3" /> Lihat File
        </a>
      </div>
    </div>
  );
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

function unwrapApi(json: any) {
  if (!json) return json;
  if (json.data) return json.data;
  if (json.success && json.data) return json.data;
  return json;
}

export default function PermitDetailPage() {
  const { id: permitId } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");

  // template picker
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // download format
  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "docx">("pdf");

  const { data: permit, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/permits/${permitId}`],
  });

  const { data: templatesRaw } = useQuery<any>({
    queryKey: ["/api/admin/letter-templates"],
  });

  const templates = useMemo(() => {
    const t = unwrapApi(templatesRaw);
    return Array.isArray(t) ? t : (t?.items ?? []);
  }, [templatesRaw]);

  // auto-select first template
  useEffect(() => {
    if (!selectedTemplateId && templates?.length) setSelectedTemplateId(templates[0].id);
  }, [templates, selectedTemplateId]);

  const templateReady = !!selectedTemplateId;

  const StatusIcon = useMemo(() => (STATUS_ICONS[permit?.status] || Clock), [permit?.status]);

  const nextStatuses = useMemo(() => {
    if (!permit?.status) return [];
    return (
      {
        submitted: ["in_review", "rejected"],
        in_review: ["revision_requested", "approved", "rejected"],
        revision_requested: ["in_review", "rejected"],
        approved: ["generated_letter"],
        generated_letter: ["sent"],
        sent: [],
        rejected: [],
      }[permit.status] || []
    );
  }, [permit?.status]);

  // --- Mutations ---

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

  // Generate HTML letter (.html) + create generatedLetters row
  // ✅ kirim templateId agar backend pakai template terpilih
  const generateHtmlMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template dulu");
      const res = await apiRequest("POST", `/api/admin/permits/${permitId}/generate-letter`, {
        templateId: selectedTemplateId,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
      toast({ title: "Surat HTML berhasil digenerate" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Download DOCX (endpoint POST attachment -> fetch blob -> download)
  // ✅ kirim templateId agar backend pakai template terpilih (dan tercatat templateId-nya)
  const downloadDocxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error("Pilih template dulu");
      const res = await apiRequest("POST", `/api/admin/permits/${permitId}/generate-letter-docx`, {
        templateId: selectedTemplateId,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.blob();
    },
    onSuccess: (blob) => {
      const fn = `${permit?.requestNumber || "surat-izin"}-${Date.now()}.docx`.replace(/\s+/g, "-");
      downloadBlob(blob, fn);
      toast({ title: "DOCX terunduh" });

      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
    },
    onError: (e: any) => toast({ title: "Gagal download DOCX", description: e.message, variant: "destructive" }),
  });

  // ✅ Preview PDF: pakai endpoint yang kamu panggil di downloadPdf
  // Endpoint yang dibutuhkan di backend:
  // GET /api/admin/permits/:id/letter/download?format=pdf&templateId=...
  // Untuk preview kita pakai endpoint yg sama tapi inline di iframe.
  const openPreviewPdf = async () => {
    if (!selectedTemplateId) {
      toast({ title: "Pilih template dulu", variant: "destructive" });
      return;
    }

    // Supaya surat sudah ada (opsional), generate html dulu jika belum ada atau template berubah
    // NOTE: akan lebih akurat kalau backend support "preview pdf" stateless.
    if (!permit?.generatedLetter?.fileUrl || permit?.generatedLetter?.templateId !== selectedTemplateId) {
      await generateHtmlMutation.mutateAsync();
    }

    // ✅ preview via iframe ke endpoint pdf
    const pdfUrl = `/api/admin/permits/${permitId}/letter/download?format=pdf&templateId=${encodeURIComponent(
      selectedTemplateId,
    )}`;

    setPreviewUrl(pdfUrl);
    setPreviewOpen(true);
  };

  // ✅ Download PDF (harus backend support templateId)
  const downloadPdf = () => {
    if (!selectedTemplateId) {
      toast({ title: "Pilih template dulu", variant: "destructive" });
      return;
    }
    window.open(
      `/api/admin/permits/${permitId}/letter/download?format=pdf&templateId=${encodeURIComponent(selectedTemplateId)}`,
      "_blank",
    );
  };

  const doDownload = () => {
    if (downloadFormat === "docx") downloadDocxMutation.mutate();
    else downloadPdf();
  };

  useEffect(() => {
    return () => {
      // kalau suatu saat preview pakai blob, revoke URL di sini
    };
  }, [previewUrl]);

  // --- UI States ---
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

  if (!permit) return <div className="p-6 text-muted-foreground">Permohonan tidak ditemukan</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLoc("/permits")} data-testid="button-back">
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
            <StatusIcon className={`w-3.5 h-3.5 ${STATUS_COLORS[permit.status]}`} />
            {STATUS_LABELS[permit.status] || permit.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
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
                    ? format(new Date(permit.introLetterDate), "d MMMM yyyy", { locale: localeId })
                    : "-"
                }
              />
            </CardContent>
          </Card>

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

          {/* Surat */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <FileCheck className="w-4 h-4" /> Surat Izin Penelitian
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {/* Template picker */}
              <div className="flex flex-col gap-2">
                <Label>Pilih Template Surat</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!templateReady && (
                  <div className="text-xs text-muted-foreground">Pilih template dulu untuk menampilkan aksi surat.</div>
                )}
              </div>

              {/* Existing stored file link (optional) */}
              {permit.generatedLetter?.fileUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={permit.generatedLetter.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary flex items-center gap-1 hover-elevate"
                  >
                    <ExternalLink className="w-3 h-3" /> Buka file tersimpan
                  </a>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Surat belum tersedia untuk template ini. Generate dulu untuk preview & download.
                </div>
              )}

              {/* Actions: only when template selected */}
              {templateReady ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={openPreviewPdf}
                    disabled={generateHtmlMutation.isPending}
                    title="Preview PDF"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {generateHtmlMutation.isPending ? "Menyiapkan..." : "Preview PDF"}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Select value={downloadFormat} onValueChange={(v: any) => setDownloadFormat(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button onClick={doDownload} disabled={downloadDocxMutation.isPending}>
                      <Download className="w-4 h-4 mr-2" />
                      {downloadDocxMutation.isPending ? "Memproses..." : "Download"}
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => generateHtmlMutation.mutate()}
                    disabled={generateHtmlMutation.isPending}
                    title="Generate HTML (untuk file tersimpan / audit)"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    {generateHtmlMutation.isPending ? "Membuat..." : "Generate HTML"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => downloadDocxMutation.mutate()}
                    disabled={downloadDocxMutation.isPending}
                    title="Generate & download DOCX"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    {downloadDocxMutation.isPending ? "Membuat DOCX..." : "Generate & Download DOCX"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
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
                        {nextStatuses.map((s: string) => (
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
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS_COLORS[h.toStatus] || "text-muted-foreground"}`} />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{STATUS_LABELS[h.toStatus] || h.toStatus}</span>
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

      {/* Preview Modal */}
      <Dialog
        open={previewOpen}
        onOpenChange={(o) => {
          setPreviewOpen(o);
          if (!o) setPreviewUrl(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview Surat (PDF)</DialogTitle>
          </DialogHeader>

          <div className="h-[80vh] w-full rounded border bg-muted overflow-hidden">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full" />
            ) : (
              <div className="p-6 text-muted-foreground">Tidak ada preview</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}