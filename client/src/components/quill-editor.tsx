import { useRef, useEffect, useCallback, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

interface CaptionDialogState {
  open: boolean;
  file: File | null;
  previewUrl: string | null;
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = "Tulis konten di sini...",
  className = "",
  minHeight = 360,
}: QuillEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [captionDialog, setCaptionDialog] = useState<CaptionDialogState>({
    open: false, file: null, previewUrl: null,
  });
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  const uploadFile = async (file: File): Promise<string> => {
    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await apiRequest("POST", "/api/admin/news/upload-image", fd);

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      toast({
        title: "Upload berhasil",
        description: file.name,
      });

      return data.url || data.fileUrl;
    } catch (err: any) {
      toast({
        title: "Upload gagal",
        description: err.message || "Terjadi kesalahan saat upload",
        variant: "destructive",
      });

      throw err;
    }
  };

  const insertImageWithCaption = useCallback(async (file: File, cap: string) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      const range = quill.getSelection(true);
      const index = range?.index ?? quill.getLength();
      quill.insertEmbed(index, "image", url);
      if (cap.trim()) {
        quill.insertText(index + 1, "\n");
        quill.formatLine(index + 2, 1, { align: "center" });
        quill.insertText(index + 2, cap.trim(), { italic: true, color: "#6b7280" });
        quill.insertText(index + 2 + cap.trim().length, "\n");
        quill.setSelection(index + 3 + cap.trim().length, 0);
      } else {
        quill.setSelection(index + 1, 0);
      }
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, []);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setCaptionDialog({ open: true, file, previewUrl: URL.createObjectURL(file) });
      setCaption("");
    };
  }, []);

  const handleCaptionConfirm = async () => {
    if (!captionDialog.file) return;
    await insertImageWithCaption(captionDialog.file, caption);
    setCaptionDialog({ open: false, file: null, previewUrl: null });
    setCaption("");
  };

  useEffect(() => {
    let origOnCapturePaste: any = null;
    let clipboard: any = null;

    const setup = () => {
      try {
        const quill = quillRef.current?.getEditor() as any;
        if (!quill) return false;
        clipboard = quill.getModule("clipboard");
        if (!clipboard) return false;

        origOnCapturePaste = clipboard.onCapturePaste.bind(clipboard);
        clipboard.onCapturePaste = (e: ClipboardEvent) => {
          const items = e.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith("image/")) {
                e.preventDefault();
                e.stopPropagation();
                const file = items[i].getAsFile();
                if (file) {
                  setCaptionDialog({ open: true, file, previewUrl: URL.createObjectURL(file) });
                  setCaption("");
                }
                return;
              }
            }
          }
          origOnCapturePaste(e);
        };
        return true;
      } catch {
        return false;
      }
    };

    const timer = setTimeout(() => { setup(); }, 100);

    return () => {
      clearTimeout(timer);
      if (clipboard && origOnCapturePaste) {
        clipboard.onCapturePaste = origOnCapturePaste;
      }
    };
  }, []);

  const modules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ],
      handlers: { image: imageHandler },
    },
    clipboard: { matchVisual: false },
  };

  const formats = [
    "header", "bold", "italic", "underline", "strike",
    "color", "background", "align",
    "list", "indent",
    "blockquote", "code-block",
    "link", "image",
  ];

  return (
    <>
      <div
        className={`quill-wrapper rounded-md border border-input ${className}`}
        style={{ minHeight: minHeight + 42 }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{ minHeight }}
        />
        <style>{`
          .quill-wrapper .ql-editor {
            min-height: ${minHeight}px;
            font-size: 0.9rem;
            line-height: 1.6;
          }
          .quill-wrapper .ql-toolbar {
            border-radius: 6px 6px 0 0;
            border-color: hsl(var(--border));
            background: hsl(var(--background));
          }
          .quill-wrapper .ql-container {
            border-radius: 0 0 6px 6px;
            border-color: hsl(var(--border));
          }
          .quill-wrapper .ql-editor.ql-blank::before {
            color: hsl(var(--muted-foreground));
            font-style: normal;
          }
          .quill-wrapper .ql-editor img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
          }
        `}</style>
      </div>

      <Dialog open={captionDialog.open} onOpenChange={o => { if (!o) setCaptionDialog({ open: false, file: null, previewUrl: null }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sisipkan Gambar</DialogTitle>
            <DialogDescription>Tambahkan caption opsional untuk gambar ini.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {captionDialog.previewUrl && (
              <img
                src={captionDialog.previewUrl}
                alt="Preview"
                className="w-full max-h-48 object-contain rounded-md border bg-muted"
              />
            )}
            <div className="flex flex-col gap-2">
              <Label>Caption (opsional)</Label>
              <Input
                placeholder="Keterangan gambar..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCaptionConfirm(); } }}
                autoFocus
                data-testid="input-image-caption"
              />
              <p className="text-xs text-muted-foreground">Kosongkan jika tidak perlu keterangan</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCaptionDialog({ open: false, file: null, previewUrl: null })}
              >
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={handleCaptionConfirm}
                disabled={uploading}
                data-testid="button-insert-image"
              >
                {uploading ? "Mengupload..." : "Sisipkan Gambar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
