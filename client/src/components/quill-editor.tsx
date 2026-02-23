import { useRef, useEffect, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { apiRequest } from "@/lib/queryClient";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = "Tulis konten di sini...",
  className = "",
  minHeight = 360,
}: QuillEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const fd = new FormData();
      fd.append("image", file);

      try {
        const res = await apiRequest("POST", "/api/admin/news/upload-image", fd);
        if (!res.ok) throw new Error("Upload gagal");
        const data = await res.json();
        const url = data.url || data.fileUrl;

        const quill = quillRef.current?.getEditor();
        if (!quill) return;
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, "image", url);
        quill.setSelection(range.index + 1, 0);
      } catch (err) {
        console.error("Image upload failed:", err);
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
      `}</style>
    </div>
  );
}
