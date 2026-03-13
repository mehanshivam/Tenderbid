import type { TenderFilters, TenderListResponse, Tender, TenderDocument, Portal, Corrigendum } from "./types";

const API_BASE = "/api/proxy";

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

export async function fetchTenders(filters: TenderFilters = {}): Promise<TenderListResponse> {
  const qs = buildQueryString(filters);
  const res = await fetch(`${API_BASE}/tenders${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch tenders: ${res.status}`);
  return res.json();
}

export async function fetchTenderDetail(tenderId: string): Promise<Tender> {
  const res = await fetch(`${API_BASE}/tenders/${encodeURIComponent(tenderId)}`);
  if (!res.ok) throw new Error(`Failed to fetch tender: ${res.status}`);
  return res.json();
}

export async function fetchTenderDocuments(tenderId: string): Promise<TenderDocument[]> {
  const res = await fetch(`${API_BASE}/tenders/${encodeURIComponent(tenderId)}/documents`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  const data = await res.json();
  return data.documents || data;
}

export async function fetchTenderCorrigendums(tenderId: string): Promise<Corrigendum[]> {
  const res = await fetch(`${API_BASE}/tenders/${encodeURIComponent(tenderId)}/corrigendums`);
  if (!res.ok) throw new Error(`Failed to fetch corrigendums: ${res.status}`);
  return res.json();
}

export async function fetchPortals(): Promise<Portal[]> {
  const res = await fetch(`${API_BASE}/tenders/portals`);
  if (!res.ok) throw new Error(`Failed to fetch portals: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/stats/overview`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}

export function getDocumentDownloadUrl(docId: number): string {
  return `${API_BASE}/tenders/documents/${docId}/download`;
}
