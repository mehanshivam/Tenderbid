import { create } from "zustand";
import type { UploadedFile } from "@/lib/types";

interface UploadStore {
  files: UploadedFile[];
  tenderName: string;
  setUpload: (name: string, files: UploadedFile[]) => void;
  clear: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  files: [],
  tenderName: "",
  setUpload: (name, files) => set({ tenderName: name, files }),
  clear: () => set({ tenderName: "", files: [] }),
}));
