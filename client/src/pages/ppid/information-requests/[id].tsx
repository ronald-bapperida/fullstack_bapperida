import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Download, FileQuestion, ExternalLink, Upload, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pending:   "Menunggu",
  in_review: "Sedang Diproses",
  resolved:  "Selesai",
  rejected:  "Ditolak",
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  in_review: "bg-blue-100 text-blue-800 border-blue-300",
  resolved:  "bg-green-100 text-green-800 border-green-300",
  rejected:  "bg-red-100 text-red-800 border-red-300",
};

const RETRIEVAL_LABELS: Record<string, string> = {
  ambil_langsung:  "Ambil Langsung",
  email:           "Email",
  salinan_cetak:   "Salinan Cetak",
  salinan_digital: "Salinan Digital",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="col-span-2 text-sm">{value || <span className="text-muted-foreground italic">—</span>}</span>
    </div>
  );
}

export default function PpidInfoRequestDetailPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);

  const { data: item, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/ppid/information-requests", paramId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/ppid/information-requests/${paramId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!paramId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("status", newStatus);
      if (reviewNote) fd.append("reviewNote", reviewNote);
      if (responseFile) fd.append("responseFile", responseFile);
      const res = await fetch(`/api/admin/ppid/information-requests/${paramId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ppid/information-requests", paramId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ppid/information-requests"] });
      toast({ title: "Status berhasil diperbarui", description: item?.email ? `Email notifikasi dikirim ke ${item.email}` : undefined });
      setNewStatus("");
      setReviewNote("");
      setResponseFile(null);
    },
    onError: (e: any) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!item) return (
    <div className="p-6">
      <p className="text-muted-foreground">Data tidak ditemukan.</p>
      <Button variant="outline" onClick={() => setLocation("/ppid/information-requests")} className="mt-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/ppid/information-requests")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-blue-500" /> Detail Permohonan Informasi
          </h1>
          <p className="text-sm text-muted-foreground">
            Diterima {format(new Date(item.createdAt), "d MMMM yyyy, HH:mm", { locale: id })}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Token display */}
      {item.token && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <div className="text-xs text-blue-600 font-medium">Kode Permohonan:</div>
          <code className="text-base font-bold tracking-widest text-blue-800 dark:text-blue-300 bg-white dark:bg-blue-950/30 px-3 py-1 rounded border border-blue-200 dark:border-blue-700">
            {item.token}
          </code>
          <span className="text-xs text-blue-500 ml-auto">Kode ini dikirim ke email pemohon dan dapat digunakan untuk mengajukan keberatan</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detail Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Data Pemohon</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Nama Lengkap" value={item.fullName} />
              <InfoRow label="NIK" value={item.nik} />
              <InfoRow label="Alamat" value={item.address} />
              <InfoRow label="No. Telepon" value={item.phone} />
              <InfoRow label="Email" value={item.email} />
              <InfoRow label="Pekerjaan" value={item.occupation} />
              {item.ktpFileUrl && (
                <InfoRow label="Scan KTP" value={
                  <a href={item.ktpFileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
                    <Download className="w-3.5 h-3.5" /> Lihat / Unduh KTP
                  </a>
                } />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Detail Permohonan</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Rincian Informasi" value={<span className="whitespace-pre-line">{item.informationDetail}</span>} />
              <InfoRow label="Tujuan Permohonan" value={<span className="whitespace-pre-line">{item.requestPurpose}</span>} />
              <InfoRow label="Cara Mendapatkan" value={
                item.retrievalMethod ? (RETRIEVAL_LABELS[item.retrievalMethod] || item.retrievalMethod) : null
              } />
            </CardContent>
          </Card>

          {/* File Respons */}
          {item.responseFileUrl && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardHeader><CardTitle className="text-base text-green-800 dark:text-green-300">File Respons Admin</CardTitle></CardHeader>
              <CardContent>
                <a href={item.responseFileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-700 hover:underline font-medium">
                  <ExternalLink className="w-4 h-4" /> Lihat / Unduh File Respons
                </a>
              </CardContent>
            </Card>
          )}

          {item.reviewNote && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader><CardTitle className="text-base text-blue-800 dark:text-blue-300">Catatan Admin</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{item.reviewNote}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Update Status */}
        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle className="text-base">Tanggapi Permohonan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Status Saat Ini</Label>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ubah ke Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus} data-testid="select-new-status">
                  <SelectTrigger><SelectValue placeholder="Pilih status baru..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="in_review">Sedang Diproses</SelectItem>
                    <SelectItem value="resolved">Selesai</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catatan / Tanggapan</Label>
                <Textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Tulis tanggapan untuk pemohon..."
                  rows={4}
                  data-testid="input-review-note"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lampiran File (opsional)</Label>
                <p className="text-xs text-muted-foreground">Upload file informasi yang diminta. File ini akan dikirim ke email pemohon.</p>
                <Input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.zip"
                  onChange={(e) => setResponseFile(e.target.files?.[0] || null)}
                  data-testid="input-response-file"
                />
                {responseFile && (
                  <p className="text-xs text-green-600">File dipilih: {responseFile.name}</p>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full gap-2"
                    disabled={!newStatus || mutation.isPending}
                    data-testid="button-update-status"
                  >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {mutation.isPending ? "Menyimpan..." : "Simpan & Kirim Email"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Perubahan Status</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apakah Anda yakin ingin menyimpan perubahan status dan mengirim notifikasi email kepada pemohon?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => mutation.mutate()}>Simpan & Kirim</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {item.email && (
                <p className="text-xs text-muted-foreground text-center">Notifikasi email akan dikirim ke: {item.email}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
