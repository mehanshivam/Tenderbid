"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { useState } from "react";
import {
  Bold,
  Italic,
  Undo,
  Redo,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExtractedForm } from "@/lib/types";

interface FormEditorProps {
  form: ExtractedForm;
  onCitationClick?: (page: number) => void;
}

const typeColors: Record<string, string> = {
  form: "bg-blue-50 text-blue-700",
  annexure: "bg-purple-50 text-purple-700",
  schedule: "bg-green-50 text-green-700",
  declaration: "bg-orange-50 text-orange-700",
  other: "bg-gray-50 text-gray-700",
};

export function FormEditor({ form, onCitationClick }: FormEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    immediatelyRender: false,
    content: form.contentHtml,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2",
      },
    },
  });

  const handleDownload = async () => {
    if (!editor) return;
    setDownloading(true);
    try {
      const html = editor.getHTML();
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, filename: form.title }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-gray-500 shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">
            {form.title}
          </span>
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${typeColors[form.type] || typeColors.other}`}
          >
            {form.type}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {form.sourcePages.length > 0 && (
            <div className="flex gap-1 mr-2">
              {form.sourcePages.slice(0, 3).map((p) => (
                <button
                  key={p}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCitationClick?.(p);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                >
                  p.{p}
                </button>
              ))}
              {form.sourcePages.length > 3 && (
                <span className="text-[10px] text-gray-400">
                  +{form.sourcePages.length - 3}
                </span>
              )}
            </div>
          )}
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 bg-white">
            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-1 rounded hover:bg-gray-100 ${editor?.isActive("bold") ? "bg-gray-200" : ""}`}
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-1 rounded hover:bg-gray-100 ${editor?.isActive("italic") ? "bg-gray-200" : ""}`}
            >
              <Italic size={14} />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
              onClick={() => editor?.chain().focus().undo().run()}
              className="p-1 rounded hover:bg-gray-100"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={() => editor?.chain().focus().redo().run()}
              className="p-1 rounded hover:bg-gray-100"
            >
              <Redo size={14} />
            </button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              DOCX
            </Button>
          </div>

          {/* Editor */}
          <div className="max-h-[400px] overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </>
      )}
    </div>
  );
}
