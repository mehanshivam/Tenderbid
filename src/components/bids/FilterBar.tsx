"use client";

import { useState, useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TenderFilters } from "@/lib/types";

interface FilterBarProps {
  filters: TenderFilters;
  onFiltersChange: (filters: TenderFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const [keyword, setKeyword] = useState(filters.keyword || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [state, setState] = useState(filters.state || "");
  const [portalId, setPortalId] = useState(filters.portal_id || "");

  const handleSearch = useCallback(() => {
    onFiltersChange({
      ...filters,
      keyword: keyword || undefined,
      state: state || undefined,
      portal_id: portalId || undefined,
      page: 1,
    });
  }, [keyword, state, portalId, filters, onFiltersChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearFilters = () => {
    setKeyword("");
    setState("");
    setPortalId("");
    onFiltersChange({ page: 1, per_page: filters.per_page });
  };

  const activeFilterCount = [keyword, state, portalId].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Main search row */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search tenders by keyword..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-10"
          />
        </div>
        <Button onClick={handleSearch} className="h-10 px-6">
          Search
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-10 relative"
        >
          <SlidersHorizontal size={16} />
          <span className="ml-2 hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={16} />
            Clear
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              State
            </label>
            <Input
              placeholder="e.g. Rajasthan"
              value={state}
              onChange={(e) => setState(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Portal / Source
            </label>
            <Input
              placeholder="e.g. nic_haryana"
              value={portalId}
              onChange={(e) => setPortalId(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} variant="secondary" className="h-9 w-full">
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
