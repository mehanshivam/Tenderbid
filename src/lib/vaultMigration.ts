import type { VaultDocument, VaultDocumentMeta, VaultCategory } from "./types";
import { saveFile } from "./vaultDB";

const OLD_STORAGE_KEY = "company-vault-storage";

/**
 * Migrates vault data from old localStorage (base64) to IndexedDB (Blob).
 * Returns migrated document metadata, or empty array if no migration needed.
 */
export async function migrateVaultIfNeeded(): Promise<VaultDocumentMeta[]> {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    // Zustand persist wraps state in { state: { documents: [...] }, version: ... }
    const documents: VaultDocument[] =
      parsed?.state?.documents ?? parsed?.documents ?? [];

    if (!documents.length) {
      localStorage.removeItem(OLD_STORAGE_KEY);
      return [];
    }

    const migrated: VaultDocumentMeta[] = [];

    for (const doc of documents) {
      try {
        // Convert base64 data URL to Blob
        const response = await fetch(doc.base64Data);
        const blob = await response.blob();

        // Save blob to IndexedDB
        await saveFile(doc.id, blob, "pending");

        // Create metadata entry (no base64)
        migrated.push({
          id: doc.id,
          name: doc.name,
          category: doc.category as VaultCategory,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          uploadedAt: doc.uploadedAt,
          extractionStatus: "pending",
        });
      } catch (err) {
        console.warn(`[Vault Migration] Skipping ${doc.name}:`, err);
      }
    }

    // Remove old storage key
    localStorage.removeItem(OLD_STORAGE_KEY);
    console.log(
      `[Vault Migration] Migrated ${migrated.length}/${documents.length} documents to IndexedDB`
    );

    return migrated;
  } catch (err) {
    console.error("[Vault Migration] Failed to parse old data:", err);
    return [];
  }
}
