import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Editor } from "@tinymce/tinymce-react";

import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CheckCircle2 } from "lucide-react";

const PLACEHOLDERS = [
  "{{full_name}}",
  "{{request_number}}",
  "{{nim_nik}}",
  "{{institution}}",
  "{{research_title}}",
  "{{research_location}}",
  "{{research_duration}}",
  "{{date}}",
  "{{signer_name}}",
  "{{signer_signature_url}}",
];

type FormValues = {
  name: string;
  type: string;
  content: string;
};

export default function LetterTemplateForm({
  mode,
  id,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<FormValues>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name || "",
      type: initial?.type || "research_permit",
      content: initial?.content || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const url = mode === "edit" ? `/api/admin/letter-templates/${id}` : "/api/admin/letter-templates";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await apiRequest(method as any, url, data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/letter-templates"] });
      toast({ title: "Template disimpan" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const insertPlaceholder = (ph: string) => {
    editorRef.current?.insertContent(ph);
    setCopied(ph);
    setTimeout(() => setCopied(null), 1200);
  };

  const editorInit = useMemo(
    () => ({
      height: 720,
      menubar: false, // sesuai request kamu
      plugins: [
        "advlist", "autolink", "lists", "link",
        "image", "table", "code", "preview", "fullscreen",
        "hr", "wordcount",
      ],
      image_title: true,
      file_picker_types: "image",
      toolbar:
        "undo redo | blocks | bold italic underline | alignleft aligncenter alignright | " +
        "bullist numlist | hr table image link | removeformat | fullscreen preview | code",
      block_formats: "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3",
      content_style: `
        body { font-family: "Times New Roman", serif; font-size: 14px; line-height: 1.6; padding: 32px; }
        hr { border: 0; border-top: 3px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 8px 0 16px; }
        img { max-width: 100%; height: auto; }
      `,
      automatic_uploads: true,
      images_upload_handler: async (blobInfo: any) => {
        const form = new FormData();
        form.append("file", blobInfo.blob(), blobInfo.filename());
      
        if (mode === "edit" && id) form.append("templateId", id);
      
        const res = await apiRequest("POST", "/api/admin/letter-templates/upload", form);
        if (!res.ok) throw new Error(await res.text());
      
        const json = await res.json();
      
        const url = json.location || json.url;
        if (!url) throw new Error("Upload response missing url/location");
      
        return url;
      },
    }),
    [],
  );

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nama Template *</Label>
          <Input {...register("name", { required: true })} placeholder="Template Izin Penelitian Default" />
        </div>

        <div className="space-y-2">
          <Label>Tipe</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="research_permit">Izin Penelitian</SelectItem>
                  <SelectItem value="general">Umum</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Placeholder</Label>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS.map((ph) => (
            <button
              key={ph}
              type="button"
              onClick={() => insertPlaceholder(ph)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border bg-muted hover:bg-muted/70 font-mono"
            >
              {copied === ph ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {ph}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Konten Template</Label>
        <div className="rounded-md border bg-white">
          <Controller
            name="content"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Editor
                apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
                onInit={(_, editor) => (editorRef.current = editor)}
                value={field.value}
                onEditorChange={field.onChange}
                init={editorInit}
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}