"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyBidsStore } from "@/store/myBidsStore";
import type { Tender, MyBidStatus } from "@/lib/types";

interface SaveBidButtonProps {
  tender: Tender;
  size?: "sm" | "default";
}

export function SaveBidButton({ tender, size = "sm" }: SaveBidButtonProps) {
  const { saveBid, removeBid, isSaved, getBidStatus } = useMyBidsStore();
  const [showMenu, setShowMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<MyBidStatus | null>(null);

  // Hydrate from store on client
  useEffect(() => {
    setSaved(isSaved(tender.tender_id));
    setStatus(getBidStatus(tender.tender_id));
  }, [isSaved, getBidStatus, tender.tender_id]);

  const handleSave = (bidStatus: MyBidStatus) => {
    saveBid(tender, bidStatus);
    setSaved(true);
    setStatus(bidStatus);
    setShowMenu(false);
  };

  const handleRemove = () => {
    removeBid(tender.tender_id);
    setSaved(false);
    setStatus(null);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <Button
        variant={saved ? "secondary" : "outline"}
        size={size}
        onClick={() => {
          if (saved) {
            setShowMenu(!showMenu);
          } else {
            setShowMenu(!showMenu);
          }
        }}
      >
        {saved ? (
          <BookmarkCheck size={14} className="mr-1.5 text-indigo-600" />
        ) : (
          <Bookmark size={14} className="mr-1.5" />
        )}
        {saved ? `Saved (${status})` : "Save"}
        <ChevronDown size={14} className="ml-1" />
      </Button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              onClick={() => handleSave("ongoing")}
            >
              Save as Ongoing
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              onClick={() => handleSave("exploring")}
            >
              Save as Exploring
            </button>
            {saved && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={handleRemove}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
