import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/contexts/auth";
import QuillEditor from "@/components/quill-editor";

interface Category { id: string; name: string; slug: string; }

export default function NewsFormPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!id;

  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/news-categories"] });
  const { data: existingNews, isLoading: loadingNews } = useQuery<any>({
    queryKey: [`/api/admin/news/${id}`],
    enabled: isEdit,
  });

  const { register, handleSubmit, control, setValue, watch, reset } = useForm({
    defaultValues: {
      title: "",
      categoryId: "",
      excerpt: "",
      url: "",
      featuredCaption: "",
      status: "draft",
      publishedAt: "",
      eventAt: "",
    },
  });

  useEffect(() => {
    if (existingNews) {
      reset({
        title: existingNews.title || "",
        categoryId: existingNews.categoryId || "",
        excerpt: existingNews.excerpt || "",
        url: existingNews.url || "",
        featuredCaption: existingNews.featuredCaption || "",
        status: existingNews.status || "draft",
        publishedAt: existingNews.publishedAt ? existingNews.publishedAt.split("T")[0] : "",
        eventAt: existingNews.eventAt ? existingNews.eventAt.split("T")[0] : "",
      });
      setContent(existingNews.content || "");
      if (existingNews.featuredImage) setFeaturedImagePreview(existingNews.featuredImage);
    }
  }, [existingNews, reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, content };
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      if (featuredImageFile) fd.append("featuredImage", featuredImageFile);
      const res = isEdit
        ? await apiRequest("PATCH", `/api/admin/news/${id}`, fd)
        : await apiRequest("POST", "/api/admin/news", fd);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({ title: isEdit ? "Berita diupdate!" : "Berita berhasil dibuat!" });
      setLoc("/news");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFeaturedImageFile(file);
      setFeaturedImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitForm = handleSubmit((data) => {
    if (!content || content === "<p><br></p>" || content.trim() === "") {
      toast({ title: "Error", description: "Konten berita tidak boleh kosong", variant: "destructive" });
      return;
    }
    mutation.mutate(data);
  });

  if (isEdit && loadingNews) return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><Skeleton className="h-96 w-full" /></div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLoc("/news")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Berita" : "Tambah Berita"}</h1>
      </div>

      <form onSubmit={handleSubmitForm}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Konten Berita</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Judul Berita *</Label>
                  <Input
                    {...register("title", { required: true })}
                    placeholder="Judul berita yang menarik..."
                    data-testid="input-news-title"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Konten Berita *</Label>
                  <QuillEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Tulis konten berita di sini..."
                    minHeight={360}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gunakan toolbar untuk format teks, heading, list, dan sisipkan gambar.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Ringkasan (Excerpt)</Label>
                  <Textarea {...register("excerpt")} rows={3} placeholder="Ringkasan singkat berita..." />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>URL Eksternal (opsional)</Label>
                  <Input {...register("url")} type="url" placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Publikasi</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Controller name="status" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-news-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Tanggal Publikasi</Label>
                  <Input type="date" {...register("publishedAt")} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Tanggal Kegiatan</Label>
                  <Input type="date" {...register("eventAt")} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Kategori</Label>
                  <Controller name="categoryId" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={mutation.isPending}
                  data-testid="button-save-news"
                >
                  <Save className="w-4 h-4" />
                  {mutation.isPending ? "Menyimpan..." : "Simpan Berita"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Gambar Utama</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                {featuredImagePreview && (
                  <div className="relative">
                    <img src={featuredImagePreview} alt="Preview" className="w-full aspect-video object-cover rounded-md" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => { setFeaturedImageFile(null); setFeaturedImagePreview(null); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <Label
                  htmlFor="featured-image-input"
                  className="flex flex-col items-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {featuredImageFile ? featuredImageFile.name : "Klik untuk upload gambar"}
                  </span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, WEBP max 5MB</span>
                </Label>
                <input
                  id="featured-image-input"
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleImageChange}
                  data-testid="input-featured-image"
                />

                <div className="flex flex-col gap-2">
                  <Label>Caption Gambar</Label>
                  <Input {...register("featuredCaption")} placeholder="Keterangan gambar..." />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
