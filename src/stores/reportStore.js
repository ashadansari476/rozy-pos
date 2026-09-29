import { create } from "zustand";
import { buildReport, getTodayStats, startOfDay, endOfDay, startOfWeek, startOfMonth } from "../lib/reports";

export const useReports = create((set, get) => ({
  report: null,
  loading: false,
  range: "today",
  counter: "Both",
  customFrom: null,
  customTo: null,

  setCounter: (counter) => {
    set({ counter });
    get().load();
  },

  setRange: (range) => {
    const now = new Date();
    let from, to;

    if (range === "today") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (range === "week") {
      from = startOfWeek(now);
      to = endOfDay(now);
    } else if (range === "month") {
      from = startOfMonth(now);
      to = endOfDay(now);
    } else if (range === "custom") {
      from = get().customFrom || startOfDay(now);
      to = get().customTo || endOfDay(now);
    }

    set({ range });
    get().load();
  },

  setCustomRange: (from, to) => {
    set({ customFrom: from, customTo: to, range: "custom" });
    get().load();
  },

  load: async () => {
    set({ loading: true });
    const { range, counter, customFrom, customTo } = get();
    const now = new Date();
    let from, to;

    if (range === "today") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (range === "week") {
      from = startOfWeek(now);
      to = endOfDay(now);
    } else if (range === "month") {
      from = startOfMonth(now);
      to = endOfDay(now);
    } else {
      from = customFrom;
      to = customTo;
    }

    const report = await buildReport({ from, to, counter });
    set({ report, loading: false });
  },
}));