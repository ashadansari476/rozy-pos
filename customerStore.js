import { create } from "zustand";
import * as api from "../lib/customers";

export const useCustomers = create((set, get) => ({
  customers: [],
  orders: [],
  orderStats: null,
  loading: false,

  loadCustomers: async () => {
    set({ loading: true });
    const customers = await api.getAllCustomers();
    set({ customers, loading: false });
  },

  loadOrders: async () => {
    set({ loading: true });
    const [orders, orderStats] = await Promise.all([
      api.getAllOrders({}),
      api.getOrderStats(),
    ]);
    set({ orders, orderStats, loading: false });
  },

  addCustomer: async (data) => {
    await api.addCustomer(data);
    await get().loadCustomers();
  },

  updateCustomer: async (id, data) => {
    await api.updateCustomer(id, data);
    await get().loadCustomers();
  },

  removeCustomer: async (id) => {
    await api.deleteCustomer(id);
    await get().loadCustomers();
  },

  refresh: async () => {
    await Promise.all([get().loadCustomers(), get().loadOrders()]);
  },
}));