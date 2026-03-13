"use client";

import { useMyBidsStore } from "@/store/myBidsStore";
import { TenderCard } from "@/components/bids/TenderCard";
import { Inbox } from "lucide-react";

export default function OngoingBidsPage() {
  const bids = useMyBidsStore((s) => s.bids.filter((b) => b.status === "ongoing"));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ongoing Bids</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tenders you are actively working on
        </p>
      </div>

      {bids.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Inbox size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No ongoing bids</p>
          <p className="text-sm text-gray-400 mt-1">
            Save tenders from All Bids as &quot;Ongoing&quot; to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bids.map((bid) => (
            <TenderCard key={bid.tender.tender_id} tender={bid.tender} />
          ))}
        </div>
      )}
    </div>
  );
}
