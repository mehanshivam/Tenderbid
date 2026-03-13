"use client";

import { useState } from "react";
import { FilterBar } from "@/components/bids/FilterBar";
import { TenderList } from "@/components/bids/TenderList";
import { useTenders } from "@/hooks/useTenders";
import type { TenderFilters } from "@/lib/types";

export default function AllBidsPage() {
  const [filters, setFilters] = useState<TenderFilters>({
    page: 1,
    per_page: 20,
    sort_by: "closing_date",
    sort_order: "asc",
  });

  const { data, isLoading, error } = useTenders(filters);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Bids</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse and discover government tenders
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={(newFilters) =>
          setFilters({ ...filters, ...newFilters })
        }
      />

      {/* Tender List */}
      <TenderList
        data={data}
        isLoading={isLoading}
        error={error}
        page={filters.page || 1}
        onPageChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
