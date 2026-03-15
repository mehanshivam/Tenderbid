import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  VaultDocumentMeta,
  CompanyProfile,
  ExtractionStatus,
  VaultCategory,
  ExtractedMetadata,
} from "@/lib/types";
import { deleteFile as deleteFromDB } from "@/lib/vaultDB";

interface VaultState {
  documents: VaultDocumentMeta[];
  companyProfile: CompanyProfile | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  isHydrated: boolean;

  // Document actions
  addDocument: (doc: VaultDocumentMeta) => void;
  addDocuments: (docs: VaultDocumentMeta[]) => void;
  removeDocument: (id: string) => void;
  updateExtractionStatus: (
    id: string,
    status: ExtractionStatus,
    metadata?: ExtractedMetadata
  ) => void;
  updateCategory: (id: string, category: VaultCategory) => void;
  getByCategory: (category: string) => VaultDocumentMeta[];

  // Profile actions
  setCompanyProfile: (profile: CompanyProfile) => void;

  // Onboarding actions
  setOnboardingComplete: (val: boolean) => void;
  setOnboardingStep: (step: number) => void;

  // Hydration
  setHydrated: () => void;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      documents: [],
      companyProfile: null,
      onboardingComplete: false,
      onboardingStep: 0,
      isHydrated: false,

      addDocument: (doc) => {
        set({ documents: [...get().documents, doc] });
      },

      addDocuments: (docs) => {
        set({ documents: [...get().documents, ...docs] });
      },

      removeDocument: (id) => {
        // Also remove blob from IndexedDB
        deleteFromDB(id).catch(console.error);
        set({ documents: get().documents.filter((d) => d.id !== id) });
      },

      updateExtractionStatus: (id, status) => {
        set({
          documents: get().documents.map((d) =>
            d.id === id ? { ...d, extractionStatus: status } : d
          ),
        });
      },

      updateCategory: (id, category) => {
        set({
          documents: get().documents.map((d) =>
            d.id === id ? { ...d, category } : d
          ),
        });
      },

      getByCategory: (category) => {
        return get().documents.filter((d) => d.category === category);
      },

      setCompanyProfile: (profile) => {
        set({ companyProfile: profile });
      },

      setOnboardingComplete: (val) => {
        set({ onboardingComplete: val });
      },

      setOnboardingStep: (step) => {
        set({ onboardingStep: step });
      },

      setHydrated: () => {
        set({ isHydrated: true });
      },
    }),
    {
      name: "company-vault-meta",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
