import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tender, MyBid, MyBidStatus } from "@/lib/types";

interface MyBidsState {
  bids: MyBid[];
  saveBid: (tender: Tender, status: MyBidStatus) => void;
  removeBid: (tenderId: string) => void;
  updateStatus: (tenderId: string, status: MyBidStatus) => void;
  isSaved: (tenderId: string) => boolean;
  getBidStatus: (tenderId: string) => MyBidStatus | null;
}

export const useMyBidsStore = create<MyBidsState>()(
  persist(
    (set, get) => ({
      bids: [],
      saveBid: (tender, status) => {
        const existing = get().bids.find((b) => b.tender.tender_id === tender.tender_id);
        if (existing) {
          set({
            bids: get().bids.map((b) =>
              b.tender.tender_id === tender.tender_id ? { ...b, status } : b
            ),
          });
        } else {
          set({
            bids: [...get().bids, { tender, status, savedAt: new Date().toISOString() }],
          });
        }
      },
      removeBid: (tenderId) => {
        set({ bids: get().bids.filter((b) => b.tender.tender_id !== tenderId) });
      },
      updateStatus: (tenderId, status) => {
        set({
          bids: get().bids.map((b) =>
            b.tender.tender_id === tenderId ? { ...b, status } : b
          ),
        });
      },
      isSaved: (tenderId) => get().bids.some((b) => b.tender.tender_id === tenderId),
      getBidStatus: (tenderId) => {
        const bid = get().bids.find((b) => b.tender.tender_id === tenderId);
        return bid ? bid.status : null;
      },
    }),
    { name: "my-bids-storage" }
  )
);
