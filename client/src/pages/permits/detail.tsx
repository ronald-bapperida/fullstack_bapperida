import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Clock, CheckCircle, XCircle, FileCheck, Send, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

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
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover-elevate">
          <ExternalLink className="w-3 h-3" /> Lihat File
        </a>
      </div>
    </div>
  );
}

export default function PermitDetailPage() {
  const { id: permitId } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");

  const { data: permit, isLoading } = useQuery<any>({ queryKey: [`/api/admin/permits/${permitId}`] });

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

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/permits/${permitId}/generate-letter`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/permits/${permitId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permits"] });
      toast({ title: "Surat izin berhasil digenerate!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><Skeleton className="h-64 w-full" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );

  if (!permit) return <div className="p-6 text-muted-foreground">Permohonan tidak ditemukan</div>;

  const StatusIcon = STATUS_ICONS[permit.status] || Clock;

  const nextStatuses = {
    submitted: ["in_review", "rejected"],
    in_review: ["revision_requested", "approved", "rejected"],
    revision_requested: ["in_review", "rejected"],
    approved: ["generated_letter"],
    generated_letter: ["sent"],
    sent: [],
    rejected: [],
  }[permit.status] || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLoc("/permits")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{permit.requestNumber}</h1>
          <p className="text-muted-foreground text-sm">{permit.fullName} · {permit.institution}</p>
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
              <InfoRow label="Tanggal Surat" value={permit.introLetterDate ? format(new Date(permit.introLetterDate), "d MMMM yyyy", { locale: id }) : "-"} />
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

          {permit.generatedLetter && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle className="text-base text-primary flex items-center gap-2"><FileCheck className="w-4 h-4" /> Surat Izin Penelitian</CardTitle></CardHeader>
              <CardContent>
                <a href={permit.generatedLetter.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary">
                  <ExternalLink className="w-4 h-4" />
                  Lihat/Unduh Surat
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
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
                        {nextStatuses.map((s: string) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Catatan (opsional)</Label>
                    <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tambahkan catatan untuk pemohon..." />
                  </div>
                  <Button
                    onClick={() => statusMutation.mutate({ status: newStatus, note })}
                    disabled={!newStatus || statusMutation.isPending}
                    data-testid="button-update-status"
                  >
                    {statusMutation.isPending ? "Memproses..." : "Update Status"}
                  </Button>
                  {permit.status === "approved" && (
                    <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-letter">
                      <FileCheck className="w-4 h-4 mr-2" />
                      {generateMutation.isPending ? "Membuat surat..." : "Generate Surat"}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Status sudah final</p>
              )}
              {permit.status === "approved" && (
                <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="mt-2" data-testid="button-generate-letter-approved">
                  <FileCheck className="w-4 h-4 mr-2" />
                  {generateMutation.isPending ? "Membuat surat..." : "Generate Surat Izin"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Status</CardTitle></CardHeader>
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
                          <span className="text-xs text-muted-foreground">{format(new Date(h.createdAt), "d MMM yyyy HH:mm", { locale: id })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">Belum ada riwayat</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
