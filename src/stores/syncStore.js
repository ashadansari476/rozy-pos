import { create } from "zustand";
import { fullSync, isSyncConfigured, isOnline } from "../lib/syncEngine";
import { db } from "../lib/db";

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
      const pendingCount = await db.syncQueue.count();
      const partialFailure = Array.isArray(result?.errors) && result.errors.length > 0;
      const message = partialFailure
        ? `Sync incomplete. ${result.errors.length} operation(s) need attention. ${result.errors.slice(0, 3).join(" | ")}`
        : null;

      set({
        status: partialFailure ? "error" : "success",
        lastSync: parseInt(localStorage.getItem("rozy-pos-last-sync") || "0", 10),
        pendingCount,
        error: message,
      });

      // Notify other components to refresh regardless of success, because partial syncs
      // may still have imported some valid remote changes.
      window.dispatchEvent(new CustomEvent("sync-complete"));

      // Only clear a successful status automatically. Preserve partial-sync details until
      // the user starts another attempt or explicitly changes the status.
      if (!partialFailure) {
        setTimeout(() => {
          if (get().status === "success") set({ status: "idle" });
        }, 3000);
      }

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