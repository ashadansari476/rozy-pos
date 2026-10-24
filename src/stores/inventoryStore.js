import { create } from "zustand";
import {
  getInventoryStats, getMovements, getWastage, getExpiringBatches,
  getExpiredBatches, getAllSuppliers, getPurchases, calculateProfit,
} from "../lib/inventory";
import { getProductsWithStock } from "../lib/products";

function selectedShop() {
  const shop = localStorage.getItem("rozy-pos-current-shop");
  if (shop !== "rozy" && shop !== "warish") throw new Error("Select a valid bakery");
  return shop;
}

// Ignore late results from the previous bakery after the owner switches shops.
let latestInventoryLoad = 0;

export const useInventory = create((set, get) => ({
  shopId: null,
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
  error: null,

  loadAll: async (shopId = selectedShop()) => {
    if (shopId !== "rozy" && shopId !== "warish") throw new Error("Invalid bakery");
    const requestId = ++latestInventoryLoad;
    set({
      shopId, products: [], stats: null, movements: [], expiring: [],
      expired: [], suppliers: [], purchases: [], wastage: [], profit: null,
      loading: true, error: null,
    });
    try {
      const [products, stats, movements, expiring, expired, suppliers, profit] =
        await Promise.all([
          getProductsWithStock(shopId),
          getInventoryStats(shopId),
          getMovements({ limit: 200, shopId }),
          getExpiringBatches(3, shopId),
          getExpiredBatches(shopId),
          getAllSuppliers(shopId),
          calculateProfit({ shopId }),
        ]);
      if (requestId !== latestInventoryLoad || selectedShop() !== shopId) return;
      set({
        shopId, products, stats, movements, expiring, expired, suppliers,
        profit, loading: false, error: null,
      });
    } catch (error) {
      if (requestId === latestInventoryLoad && selectedShop() === shopId) {
        set({ loading: false, error: error.message, stats: null, products: [] });
      }
      throw error;
    }
  },

  loadWastage: async ({ from, to } = {}) => {
    const shopId = selectedShop();
    const wastage = await getWastage({ from, to, shopId });
    if (selectedShop() === shopId) set({ wastage });
  },

  loadPurchases: async ({ from, to } = {}) => {
    const shopId = selectedShop();
    const purchases = await getPurchases({ from, to, shopId });
    if (selectedShop() === shopId) set({ purchases });
  },

  reloadSuppliers: async () => {
    const shopId = selectedShop();
    const suppliers = await getAllSuppliers(shopId);
    if (selectedShop() === shopId) set({ suppliers });
  },

  refresh: () => get().loadAll(),
}));
