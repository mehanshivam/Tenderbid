"use client";

import Link from "next/link";
import { Building2, MapPin, FileText, Calendar, IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveBidButton } from "@/components/my-bids/SaveBidButton";
import { formatCurrency, daysLeft, formatDate } from "@/lib/format";
import type { Tender } from "@/lib/types";

interface TenderCardProps {
  tender: Tender;
}

export function TenderCard({ tender }: TenderCardProps) {
  const days = daysLeft(tender.closing_date);
  const isUrgent = days <= 7 && days > 0;
  const isExpired = days <= 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
      {/* Top row: ID + badges */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono text-gray-400">#{tender.id}</span>
          {tender.estimated_value && (
            <Badge variant="outline" className="text-xs">
              <IndianRupee size={12} className="mr-1" />
              {formatCurrency(tender.estimated_value)}
            </Badge>
          )}
          {tender.emd_amount && (
            <Badge variant="secondary" className="text-xs">
              EMD: {formatCurrency(tender.emd_amount)}
            </Badge>
          )}
          <Badge
            variant={isExpired ? "destructive" : isUrgent ? "destructive" : "default"}
            className="text-xs"
          >
            <Calendar size={12} className="mr-1" />
            {isExpired
              ? "Expired"
              : `${days} Day${days !== 1 ? "s" : ""} Left`}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono">
            {tender.portal_id || tender.source}
          </Badge>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
        {tender.title}
      </h3>
      {tender.work_description && tender.work_description !== tender.title && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-1">
          {tender.work_description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1.5">
          <Building2 size={14} />
          {tender.organisation_name}
        </span>
        {tender.state_name && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {tender.state_name}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <FileText size={14} />
          {tender.document_count} Document{tender.document_count !== 1 ? "s" : ""}
        </span>
        {tender.tender_fee && (
          <span className="text-xs text-gray-400">
            Fee: {formatCurrency(tender.tender_fee)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href={`/bids/${encodeURIComponent(tender.tender_id)}`}>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <FileText size={14} className="mr-1.5" />
            View Documents
          </Button>
        </Link>
        <SaveBidButton tender={tender} />
      </div>
    </div>
  );
}
