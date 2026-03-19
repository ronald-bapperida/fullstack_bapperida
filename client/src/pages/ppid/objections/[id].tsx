import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Download, AlertTriangle } from "lucide-react";
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

export default function PpidObjectionDetailPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const { data: item, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/ppid/objections", paramId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/ppid/objections/${paramId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!paramId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/ppid/objections/${paramId}/status`, {
        status: newStatus,
        reviewNote: reviewNote || undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ppid/objections", paramId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ppid/objections"] });
      toast({ title: "Status berhasil diperbarui" });
      setNewStatus("");
      setReviewNote("");
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
      <Button variant="outline" onClick={() => setLocation("/ppid/objections")} className="mt-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/ppid/objections")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" /> Detail Keberatan PPID
          </h1>
          <p className="text-sm text-muted-foreground">
            Diterima {format(new Date(item.createdAt), "d MMMM yyyy, HH:mm", { locale: id })}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detail Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Data Pemohon</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Nama Lengkap" value={item.fullName} />
              <InfoRow label="NIK" value={item.nik} />
              <InfoRow label="Alamat" value={item.address} />
              <InfoRow label="Kontak" value={item.phone} />
              <InfoRow label="Email" value={item.email} />
              <InfoRow label="Pekerjaan" value={item.occupation} />
              <InfoRow label="Kode Permohonan" value={item.requestCode} />
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
            <CardHeader><CardTitle className="text-base">Detail Keberatan</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Rincian Informasi" value={<span className="whitespace-pre-line">{item.informationDetail}</span>} />
              <InfoRow label="Tujuan Permohonan" value={<span className="whitespace-pre-line">{item.requestPurpose}</span>} />
              <InfoRow label="Alasan Keberatan" value={
                item.objectionReasons?.length ? (
                  <ul className="list-disc list-inside space-y-0.5">
                    {item.objectionReasons.map((r: string, i: number) => <li key={i} className="text-sm">{r}</li>)}
                  </ul>
                ) : null
              } />
              <InfoRow label="Keterangan Keberatan" value={<span className="whitespace-pre-line">{item.objectionNote}</span>} />
              {item.evidenceFileUrl && (
                <InfoRow label="Lampiran Bukti" value={
                  <a href={item.evidenceFileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
                    <Download className="w-3.5 h-3.5" /> Lihat / Unduh Lampiran
                  </a>
                } />
              )}
            </CardContent>
          </Card>

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
            <CardHeader><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
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
                <Label className="text-xs">Catatan (opsional)</Label>
                <Textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Catatan untuk pemohon..."
                  rows={4}
                  data-testid="input-review-note"
                />
              </div>
              <Button
                className="w-full"
                disabled={!newStatus || mutation.isPending}
                onClick={() => mutation.mutate()}
                data-testid="button-update-status"
              >
                {mutation.isPending ? "Menyimpan..." : "Simpan Status"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
