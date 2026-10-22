import { create } from "zustand";
import * as api from "../lib/products";

export const useProducts = create((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  search: "",
  activeCategory: "All",
  shopId: "rozy",

  load: async (shopId) => {
    const sid = shopId || get().shopId || localStorage.getItem("rozy-pos-current-shop") || "rozy";
    set({ loading: true, shopId: sid });
    const [products, categories] = await Promise.all([
      api.getProductsWithStock(sid),
      api.getCategories(),
    ]);
    set({ products, categories, loading: false });
  },

  setSearch: (search) => set({ search }),
  setCategory: (activeCategory) => set({ activeCategory }),

  filtered: () => {
    const { products, search, activeCategory } = get();
    let list = products;
    if (activeCategory !== "All") {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      );
    }
    return list;
  },

   add: async (product) => {
    const id = await api.addProduct(product);
    await get().load();
    return id;
  },

    update: async (id, product) => {
    await api.updateProduct(id, product);
    await get().load();
    return id;
  },

  remove: async (id) => {
    await api.deleteProduct(id);
    await get().load();
  },

  bulkImport: async (rows) => {
    await api.bulkImportProducts(rows);
    await get().load();
  },

  addCategory: async (data) => {
    await api.addCategory(data);
    await get().load();
  },

  updateCategory: async (id, data) => {
    await api.updateCategory(id, data);
    await get().load();
  },

  removeCategory: async (id) => {
    await api.deleteCategory(id);
    await get().load();
  },
}));