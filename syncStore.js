import { create } from "zustand";
import { fullSync, isSyncConfigured, isOnline } from "../lib/syncEngine";

export const useSync = create((set, get) => ({
  status: "idle", // idle | syncing | success | error | offline
  lastSync: parseInt(localStorage.getItem("rozy-pos-last-sync") || "0"),
  pendingCount: 0,
  error: null,

  setStatus: (status, error = null) => set({ status, error }),

  sync: async () => {
    if (!isSyncConfigured()) {
      set({ status: "error", error: "Sync not configured" });
      return;
    }
    if (!isOnline()) {
      set({ status: "offline" });
      return;
    }

    set({ status: "syncing", error: null });

    try {
      const result = await fullSync();
      set({
        status: "success",
        lastSync: Date.now(),
        error: null,
      });

      // Notify other components to refresh
      window.dispatchEvent(new CustomEvent("sync-complete"));

      // Reset to idle after 3 seconds
      setTimeout(() => {
        if (get().status === "success") set({ status: "idle" });
      }, 3000);

      return result;
    } catch (e) {
      set({ status: "error", error: e.message });
      window.dispatchEvent(new CustomEvent("sync-complete"));
      setTimeout(() => {
        if (get().status === "error") set({ status: "idle", error: null });
      }, 5000);
    }
  },

  updateLastSync: (ts) => set({ lastSync: ts }),
}));