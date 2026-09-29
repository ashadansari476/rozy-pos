import { create } from "zustand";
import {
  getInventoryStats, getMovements, getWastage, getExpiringBatches,
  getExpiredBatches, getAllSuppliers, getPurchases, calculateProfit,
} from "../lib/inventory";
import { db } from "../lib/db";

export const useInventory = create((set, get) => ({
  products: [],
  stats: null,
  movements: [],
  wastage: [],
  expiring: [],
  expired: [],
  suppliers: [],
  purchases: [],
  profit: null,
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const [
      products, stats, movements, expiring, expired, suppliers, profit,
    ] = await Promise.all([
      db.products.toArray(),
      getInventoryStats(),
      getMovements({ limit: 200 }),
      getExpiringBatches(3),
      getExpiredBatches(),
      getAllSuppliers(),
      calculateProfit({}),
    ]);
    set({
      products, stats, movements, expiring, expired, suppliers, profit,
      loading: false,
    });
  },

  loadWastage: async ({ from, to }) => {
    const wastage = await getWastage({ from, to });
    set({ wastage });
  },

  loadPurchases: async ({ from, to }) => {
    const purchases = await getPurchases({ from, to });
    set({ purchases });
  },

  reloadSuppliers: async () => {
    const suppliers = await getAllSuppliers();
    set({ suppliers });
  },

  refresh: () => get().loadAll(),
}));