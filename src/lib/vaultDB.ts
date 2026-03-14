import { openDB, type IDBPDatabase } from "idb";
import type { ExtractedMetadata, CompanyProfile, ExtractionStatus } from "./types";

const DB_NAME = "company-vault";
const DB_VERSION = 1;
const FILES_STORE = "files";
const PROFILE_STORE = "companyProfile";

interface VaultFileRecord {
  id: string;
  blob: Blob;
  metadata?: ExtractedMetadata;
  extractionStatus: ExtractionStatus;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          db.createObjectStore(PROFILE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ─── File Operations ───

export async function saveFile(
  id: string,
  blob: Blob,
  extractionStatus: ExtractionStatus = "pending"
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const record: VaultFileRecord = { id, blob, extractionStatus };
  await db.put(FILES_STORE, record);
}

export async function getFile(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  const record = (await db.get(FILES_STORE, id)) as VaultFileRecord | undefined;
  return record?.blob;
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete(FILES_STORE, id);
}

// ─── Metadata Operations ───

export async function saveMetadata(
  id: string,
  metadata: ExtractedMetadata,
  status: ExtractionStatus
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const record = (await db.get(FILES_STORE, id)) as VaultFileRecord | undefined;
  if (record) {
    record.metadata = metadata;
    record.extractionStatus = status;
    await db.put(FILES_STORE, record);
  }
}

export async function updateExtractionStatus(
  id: string,
  status: ExtractionStatus
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const record = (await db.get(FILES_STORE, id)) as VaultFileRecord | undefined;
  if (record) {
    record.extractionStatus = status;
    await db.put(FILES_STORE, record);
  }
}

export async function getMetadata(
  id: string
): Promise<ExtractedMetadata | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  const record = (await db.get(FILES_STORE, id)) as VaultFileRecord | undefined;
  return record?.metadata;
}

export async function getAllMetadata(): Promise<
  { id: string; metadata: ExtractedMetadata }[]
> {
  const db = await getDB();
  if (!db) return [];
  const records = (await db.getAll(FILES_STORE)) as VaultFileRecord[];
  return records
    .filter((r) => r.metadata)
    .map((r) => ({ id: r.id, metadata: r.metadata! }));
}

// ─── Company Profile ───

export async function saveCompanyProfile(
  profile: CompanyProfile
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put(PROFILE_STORE, profile, "profile");
}

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const db = await getDB();
  if (!db) return null;
  const profile = (await db.get(PROFILE_STORE, "profile")) as
    | CompanyProfile
    | undefined;
  return profile ?? null;
}

// ─── Storage Estimate ───

export async function getStorageEstimate(): Promise<{
  used: number;
  quota: number;
}> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { used: 0, quota: 0 };
  }
  const estimate = await navigator.storage.estimate();
  return {
    used: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  };
}
