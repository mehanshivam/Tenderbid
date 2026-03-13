"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUploadStore } from "@/stores/uploadStore";
import { formatFileSize } from "@/lib/format";
import type { UploadedFile } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [tenderName, setTenderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"file" | "folder" | null>(null);
  const setUpload = useUploadStore((s) => s.setUpload);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setMode("file");
    if (!tenderName) {
      setTenderName(files[0].name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files || []);
    // Filter to supported document types
    const supported = allFiles.filter((f) =>
      /\.(pdf|xls|xlsx|csv|doc|docx|zip|rar)$/i.test(f.name)
    );
    if (supported.length === 0) return;
    setSelectedFiles(supported);
    setMode("folder");
    if (!tenderName) {
      // Use folder name from webkitRelativePath
      const path = allFiles[0]?.webkitRelativePath || "";
      const folderName = path.split("/")[0] || "Uploaded Tender";
      setTenderName(folderName);
    }
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0) return;
    const uploadedFiles: UploadedFile[] = selectedFiles.map((f, i) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return {
        id: `upload-${i}`,
        name: f.name,
        size: f.size,
        type: ext,
        blobUrl: URL.createObjectURL(f),
      };
    });
    setUpload(tenderName || "Uploaded Tender", uploadedFiles);
    router.push("/upload/workspace");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upload Tender</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload a tender PDF or a full tender folder to analyze
          </p>
        </div>

        {/* Tender name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tender Name (optional)
          </label>
          <Input
            value={tenderName}
            onChange={(e) => setTenderName(e.target.value)}
            placeholder="e.g. Construction of Bridge - Phase 2"
          />
        </div>

        {/* Upload options */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              mode === "file"
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <FileText
              size={32}
              className={mode === "file" ? "text-indigo-500" : "text-gray-400"}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800">Upload File</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Single PDF document
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Folder upload */}
          <button
            onClick={() => folderInputRef.current?.click()}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              mode === "folder"
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <FolderOpen
              size={32}
              className={
                mode === "folder" ? "text-indigo-500" : "text-gray-400"
              }
            />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800">Upload Folder</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Full tender folder
              </p>
            </div>
          </button>
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            onChange={handleFolderSelect}
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        </div>

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <FileText size={14} className="text-red-500 shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {f.name}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatFileSize(f.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={selectedFiles.length === 0}
          className="w-full gap-2"
          size="lg"
        >
          <Upload size={16} />
          Open Workspace
        </Button>
      </div>
    </div>
  );
}
