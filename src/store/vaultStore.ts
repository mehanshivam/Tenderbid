import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VaultDocument } from "@/lib/types";

interface VaultState {
  documents: VaultDocument[];
  addDocument: (doc: VaultDocument) => void;
  removeDocument: (id: string) => void;
  getByCategory: (category: string) => VaultDocument[];
  updateCategory: (id: string, category: string) => void;
  storageUsed: () => number;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      documents: [],
      addDocument: (doc) => {
        set({ documents: [...get().documents, doc] });
      },
      removeDocument: (id) => {
        set({ documents: get().documents.filter((d) => d.id !== id) });
      },
      getByCategory: (category) => {
        return get().documents.filter((d) => d.category === category);
      },
      updateCategory: (id, category) => {
        set({
          documents: get().documents.map((d) =>
            d.id === id ? { ...d, category } : d
          ),
        });
      },
      storageUsed: () => {
        return get().documents.reduce((acc, d) => acc + d.base64Data.length, 0);
      },
    }),
    { name: "company-vault-storage" }
  )
);
