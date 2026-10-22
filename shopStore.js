import { create } from "zustand";
import {
  getAllShops, getShop, getCurrentShopId, setCurrentShopId,
} from "../lib/shops";

export const useShop = create((set, get) => ({
  shops: [],
  currentShopId: getCurrentShopId(),
  currentShop: null,
  loading: false,

  loadShops: async () => {
    set({ loading: true });
    const shops = await getAllShops();
    const currentShopId = getCurrentShopId();
    const currentShop = shops.find((s) => s.id === currentShopId) || shops[0];
    set({ shops, currentShop, currentShopId: currentShop?.id, loading: false });
    if (currentShop) setCurrentShopId(currentShop.id);
  },

  switchShop: async (shopId) => {
    setCurrentShopId(shopId);
    const currentShop = await getShop(shopId);
    set({ currentShopId: shopId, currentShop });
  },

  refreshCurrent: async () => {
    const { currentShopId } = get();
    if (!currentShopId) return;
    const currentShop = await getShop(currentShopId);
    set({ currentShop });
  },
}));