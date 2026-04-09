import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileQuestion, ExternalLink, Trash2, User, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";

interface DocEntry {
  requestId: string;
  documentId: string;
  documentTitle: string;
  kindName: string | null;
  categoryName: string | null;
  typeName: string | null;
  fileUrl: string | null;
  purpose: string;
  requestedAt: string | null;
}

interface DetailResult {
  success: boolean;
  data: {
    user: { id: string; name: string; email: string; phone: string };
    documents: DocEntry[];
    total: number;
  };
}

const formatDate = (v: string | null | undefined) => {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); } catch { return "-"; }
};

export default function DocumentRequestDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useLang();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DetailResult>({
    queryKey: ["/api/admin/document-requests/user", userId],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/document-requests/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!userId,
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/document-requests/${requestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("success") || "Berhasil", description: t("docReqDeleteSuccess") });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/document-requests/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/document-requests/grouped"] });
    },
    onError: (e: any) => {
      toast({ title: t("error") || "Gagal", description: e.message, variant: "destructive" });
    },
  });

  const user = data?.data?.user;
  const documents = data?.data?.documents || [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2"
          onClick={() => navigate("/document-requests")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" /> {t("back") || "Kembali"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
          <FileQuestion className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("docReqDetailTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("docReqDetailSubtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> {t("docReqApplicantData")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("docReqFullName")}</p>
                  <p className="font-medium">{user?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {t("email") || "Email"}
                  </p>
                  <p className="text-sm">{user?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {t("phone") || "No HP"}
                  </p>
                  <p className="text-sm">{user?.phone || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t("docReqDocumentsList")}
                  <Badge variant="secondary" className="ml-2 text-xs">{documents.length} {t("docReqDocumentCount")}</Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {documents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">{t("docReqNoDocuments")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docReqDocumentName")}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docReqKind")}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docReqCategory")}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docReqType")}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("docReqFile")}</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("date") || "Tanggal"}</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("action") || "Aksi"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, i) => (
                        <tr
                          key={doc.requestId}
                          className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                          data-testid={`row-doc-${doc.requestId}`}
                        >
                          <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium leading-tight line-clamp-2">{doc.documentTitle}</p>
                            {doc.purpose && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t("purpose") || "Tujuan"}: {doc.purpose}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {doc.kindName
                              ? <Badge variant="outline" className="text-xs">{doc.kindName}</Badge>
                              : <span className="text-muted-foreground">–</span>}
                          </td>
                          <td className="px-4 py-3">
                            {doc.categoryName
                              ? <Badge variant="secondary" className="text-xs">{doc.categoryName}</Badge>
                              : <span className="text-muted-foreground">–</span>}
                          </td>
                          <td className="px-4 py-3">
                            {doc.typeName
                              ? <span className="text-xs text-muted-foreground">{doc.typeName}</span>
                              : <span className="text-muted-foreground">–</span>}
                          </td>
                          <td className="px-4 py-3">
                            {doc.fileUrl ? (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                data-testid={`link-file-${doc.requestId}`}
                              >
                                <ExternalLink className="w-3 h-3" /> {t("docReqViewFile")}
                              </a>
                            ) : <span className="text-muted-foreground text-xs">–</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(doc.requestedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                                  data-testid={`button-delete-${doc.requestId}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("docReqDeleteDoc")}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("docReqDeleteDocDesc")} <b>&quot;{doc.documentTitle}&quot;</b>?{" "}
                                    {t("actionCannotBeUndone") || "Tindakan ini tidak dapat dibatalkan."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("cancel") || "Batal"}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteSingleMutation.mutate(doc.requestId)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t("delete") || "Hapus"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
