import { db } from "./db";
import { localDateKey } from "./dates";
import { netCash } from "./money";
import { filterReportSales, filterReportItems, topItemsForReport } from "./reportShopRules";

// Shop comparison must use shopId, not the legacy counter label.
export async function getSalesInRange({ from, to, counter, shopId } = {}) {
  const all = await db.sales.toArray();
  return filterReportSales(all, { from, to, counter, shopId });
}

// Full report data for a range
export async function buildReport({ from, to, counter, shopId }) {
  const sales = await getSalesInRange({ from, to, counter, shopId });
  const allItems = await db.saleItems.toArray();
  const items = filterReportItems(allItems, sales);

  const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalDiscount = sales.reduce((s, x) => s + (x.discount || 0), 0);
  const billCount = sales.length;
  const avgBill = billCount ? totalSales / billCount : 0;

  // Payment breakdown
  const payment = { cash: 0, upi: 0, card: 0 };
  for (const s of sales) {
    if (s.payment) {
      payment.cash += netCash(s);
      payment.upi += s.payment.upi || 0;
      payment.card += s.payment.card || 0;
    }
  }

  // Aggregate only line items from the filtered shop's sales.
  const topItems = topItemsForReport(items);

  // Category breakdown (join with products)
  const products = await db.products.toArray();
  const productById = {};
  for (const p of products) {
    if (!shopId || p.shopId === shopId) productById[p.id] = p;
  }

  const catMap = {};
  for (const it of items) {
    const p = productById[it.productId];
    const cat = p?.category || "Other";
    if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, qty: 0 };
    catMap[cat].revenue += it.lineTotal || it.qty * it.price;
    catMap[cat].qty += it.qty;
  }
  const byCategory = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

  // Counter breakdown (only when viewing Both)
  const byCounter = {};
  for (const s of sales) {
    if (!byCounter[s.counter]) {
      byCounter[s.counter] = { counter: s.counter, revenue: 0, bills: 0 };
    }
    byCounter[s.counter].revenue += s.total || 0;
    byCounter[s.counter].bills += 1;
  }
  const counters = Object.values(byCounter).sort((a, b) => b.revenue - a.revenue);

  // Hourly breakdown (24 hours)
  const hourly = Array(24).fill(0);
  for (const s of sales) {
    const h = new Date(s.ts).getHours();
    hourly[h] += s.total || 0;
  }

  // Daily breakdown (for multi-day ranges)
  const dailyMap = {};
  for (const s of sales) {
    const day = localDateKey(new Date(s.ts));
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, bills: 0 };
    dailyMap[day].revenue += s.total || 0;
    dailyMap[day].bills += 1;
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    sales,
    billCount,
    totalSales,
    totalDiscount,
    avgBill,
    payment,
    topItems,
    byCategory,
    counters,
    hourly,
    daily,
  };
}

// Get today's quick stats
export async function getTodayStats(counter, shopId) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;

  return buildReport({ from: start, to: end, counter, shopId });
}

// CSV export helper
export function reportToCSV(report) {
  const lines = [];
  lines.push("ROZY POS - REPORT");
  lines.push("");

  lines.push("SUMMARY");
  lines.push(`Total Sales,${report.totalSales.toFixed(2)}`);
  lines.push(`Bills,${report.billCount}`);
  lines.push(`Average Bill,${report.avgBill.toFixed(2)}`);
  lines.push(`Total Discount,${report.totalDiscount.toFixed(2)}`);
  lines.push("");

  lines.push("PAYMENT BREAKDOWN");
  lines.push(`Cash,${report.payment.cash.toFixed(2)}`);
  lines.push(`UPI,${report.payment.upi.toFixed(2)}`);
  lines.push(`Card,${report.payment.card.toFixed(2)}`);
  lines.push("");

  lines.push("TOP ITEMS");
  lines.push("Item,Qty,Unit,Revenue");
  for (const it of report.topItems) {
    lines.push(`${it.name},${it.qty},${it.unit},${it.revenue.toFixed(2)}`);
  }
  lines.push("");

  lines.push("CATEGORY BREAKDOWN");
  lines.push("Category,Revenue,Qty");
  for (const c of report.byCategory) {
    lines.push(`${c.category},${c.revenue.toFixed(2)},${c.qty}`);
  }

  return lines.join("\n");
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Date helpers
export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
export function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}