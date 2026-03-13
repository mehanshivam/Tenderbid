"use client";

import { TenderCard } from "./TenderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { TenderListResponse } from "@/lib/types";

interface TenderListProps {
  data: TenderListResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  onPageChange: (page: number) => void;
}

export function TenderList({
  data,
  isLoading,
  error,
  page,
  onPageChange,
}: TenderListProps) {
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load tenders</p>
        <p className="text-sm text-gray-500 mt-1">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
          >
            <div className="flex gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.tenders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Inbox size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">No tenders found</p>
        <p className="text-sm text-gray-400 mt-1">
          Try adjusting your filters or search keywords
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-medium text-gray-700">
            {(page - 1) * data.per_page + 1}–
            {Math.min(page * data.per_page, data.total)}
          </span>{" "}
          of <span className="font-medium text-gray-700">{data.total.toLocaleString()}</span>{" "}
          tenders
        </p>
      </div>

      {/* Tender cards */}
      <div className="space-y-3">
        {data.tenders.map((tender) => (
          <TenderCard key={tender.tender_id} tender={tender} />
        ))}
      </div>

      {/* Pagination */}
      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          <span className="text-sm text-gray-500 px-4">
            Page {page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.total_pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
