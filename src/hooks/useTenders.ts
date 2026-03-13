import { useQuery } from "@tanstack/react-query";
import { fetchTenders, fetchTenderDetail, fetchTenderDocuments, fetchPortals, fetchTenderCorrigendums } from "@/lib/api";
import type { TenderFilters } from "@/lib/types";

export function useTenders(filters: TenderFilters = {}) {
  return useQuery({
    queryKey: ["tenders", filters],
    queryFn: () => fetchTenders(filters),
  });
}

export function useTenderDetail(tenderId: string) {
  return useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => fetchTenderDetail(tenderId),
    enabled: !!tenderId,
  });
}

export function useTenderDocuments(tenderId: string) {
  return useQuery({
    queryKey: ["tender-documents", tenderId],
    queryFn: () => fetchTenderDocuments(tenderId),
    enabled: !!tenderId,
  });
}

export function useTenderCorrigendums(tenderId: string) {
  return useQuery({
    queryKey: ["tender-corrigendums", tenderId],
    queryFn: () => fetchTenderCorrigendums(tenderId),
    enabled: !!tenderId,
  });
}

export function usePortals() {
  return useQuery({
    queryKey: ["portals"],
    queryFn: fetchPortals,
  });
}
