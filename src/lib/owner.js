import { db } from "./db";

// ============ CASH RECONCILIATION ============

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getTodayCash(shopId) {
  const date = todayKey();
  return await db.cashDrawer
    .where("[shopId+date]")
    .equals([shopId, date])
    .first();
}

export async function startDay({ shopId, openingCash, user }) {
  const date = todayKey();
  const existing = await getTodayCash(shopId);

  if (existing) {
    await db.cashDrawer.update(existing.id, {
      openingCash,
      openedAt: Date.now(),
      openedBy: user,
    });
    return existing.id;
  }

  const id = await db.cashDrawer.add({
    shopId,
    date,
    openingCash,
    openedAt: Date.now(),
    openedBy: user,
    closingCash: null,
    closedAt: null,
    closedBy: null,
    expectedCash: null,
    difference: null,
  });

  await logAudit({
    shopId,
    user,
    action: "DAY_STARTED",
    entity: "cashDrawer",
    entityId: id,
    details: { openingCash },
  });

  return id;
}

export async function endDay({ shopId, closingCash, user, notes }) {
  const date = todayKey();
  const record = await getTodayCash(shopId);
  if (!record) throw new Error("Day was not started");

  // Get today's sales for this shop
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();
  const endTs = startTs + 24 * 60 * 60 * 1000;

  const sales = await db.sales.where("shopId").equals(shopId).toArray();
  const todaySales = sales.filter((s) => s.ts >= startTs && s.ts < endTs);

  // Cash sales only
  let cashSales = 0;
  for (const s of todaySales) {
    cashSales += s.payment?.cash || 0;
  }

  const expectedCash = (record.openingCash || 0) + cashSales;
  const difference = closingCash - expectedCash;

  await db.cashDrawer.update(record.id, {
    closingCash,
    closedAt: Date.now(),
    closedBy: user,
    expectedCash,
    difference,
    notes: notes || "",
  });

  await logAudit({
    shopId,
    user,
    action: "DAY_ENDED",
    entity: "cashDrawer",
    entityId: record.id,
    details: { openingCash: record.openingCash, closingCash, expectedCash, difference },
  });

  return { expectedCash, difference, cashSales, billsCount: todaySales.length };
}

// ============ EXPENSES ============

export const EXPENSE_CATEGORIES = [
  { key: "milk", label: "Milk & Dairy", icon: "🥛" },
  { key: "electricity", label: "Electricity", icon: "⚡" },
  { key: "groceries", label: "Groceries", icon: "🍚" },
  { key: "transport", label: "Transport", icon: "🚚" },
  { key: "salary", label: "Salary", icon: "💰" },
  { key: "tea", label: "Tea / Snacks", icon: "☕" },
  { key: "maintenance", label: "Maintenance", icon: "🔧" },
  { key: "other", label: "Other", icon: "📝" },
];

export async function addExpense({ shopId, amount, category, note, user }) {
  const id = await db.expenses.add({
    shopId,
    amount,
    category,
    note: note || "",
    user,
    ts: Date.now(),
  });

  await logAudit({
    shopId,
    user,
    action: "EXPENSE_ADDED",
    entity: "expense",
    entityId: id,
    details: { amount, category },
  });

  return id;
}

export async function updateExpense(id, updates) {
  return await db.expenses.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteExpense(id) {
  return await db.expenses.delete(id);
}

export async function getExpenses({ shopId, from, to }) {
  let all = await db.expenses.toArray();
  if (shopId && shopId !== "both") {
    all = all.filter((e) => e.shopId === shopId);
  }
  if (from) all = all.filter((e) => e.ts >= from);
  if (to) all = all.filter((e) => e.ts <= to);
  return all.sort((a, b) => b.ts - a.ts);
}

export async function getExpenseSummary({ shopId, from, to }) {
  const expenses = await getExpenses({ shopId, from, to });
  const byCategory = {};
  let total = 0;

  for (const e of expenses) {
    total += e.amount;
    if (!byCategory[e.category]) byCategory[e.category] = 0;
    byCategory[e.category] += e.amount;
  }

  return { total, byCategory, count: expenses.length, expenses };
}

// ============ TARGETS ============

export async function setTarget({ shopId, date, amount, user }) {
  const existing = await db.targets
    .where("[shopId+date]")
    .equals([shopId, date])
    .first();

  if (existing) {
    await db.targets.update(existing.id, { amount, updatedAt: Date.now() });
    return existing.id;
  }

  const id = await db.targets.add({
    shopId,
    date,
    amount,
    createdBy: user,
    createdAt: Date.now(),
  });

  await logAudit({
    shopId,
    user,
    action: "TARGET_SET",
    entity: "target",
    entityId: id,
    details: { date, amount },
  });

  return id;
}

export async function getTarget(shopId, date) {
  return await db.targets
    .where("[shopId+date]")
    .equals([shopId, date])
    .first();
}

export async function getTodayTarget(shopId) {
  return await getTarget(shopId, todayKey());
}

export async function getTargetsInRange({ shopId, from, to }) {
  let all = await db.targets.toArray();
  if (shopId && shopId !== "both") {
    all = all.filter((t) => t.shopId === shopId);
  }
  if (from) all = all.filter((t) => t.date >= from);
  if (to) all = all.filter((t) => t.date <= to);
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

// ============ AUDIT LOG ============

export async function logAudit({ shopId, user, action, entity, entityId, details }) {
  return await db.auditLog.add({
    shopId,
    user: user || "system",
    action,
    entity,
    entityId,
    details: details || {},
    ts: Date.now(),
  });
}

export async function getAuditLog({ shopId, user, action, from, to, limit = 200 }) {
  let all = await db.auditLog.toArray();
  if (shopId && shopId !== "both") all = all.filter((a) => a.shopId === shopId);
  if (user) all = all.filter((a) => a.user === user);
  if (action) all = all.filter((a) => a.action === action);
  if (from) all = all.filter((a) => a.ts >= from);
  if (to) all = all.filter((a) => a.ts <= to);
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

// ============ DAY-END SUMMARY ============

export async function buildDayEndSummary({ shopId, date }) {
  const dayStart = new Date(date + "T00:00:00").getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  // Sales
  const sales = await db.sales.where("shopId").equals(shopId).toArray();
  const todaySales = sales.filter((s) => s.ts >= dayStart && s.ts < dayEnd);
  const totalSales = todaySales.reduce((s, x) => s + (x.total || 0), 0);
  const totalDiscount = todaySales.reduce((s, x) => s + (x.discount || 0), 0);

  // Payment split
  const payment = { cash: 0, upi: 0, card: 0 };
  for (const s of todaySales) {
    if (s.payment) {
      payment.cash += s.payment.cash || 0;
      payment.upi += s.payment.upi || 0;
      payment.card += s.payment.card || 0;
    }
  }

  // Top items
  const saleIds = new Set(todaySales.map((s) => s.id));
  const allItems = await db.saleItems.toArray();
  const items = allItems.filter((i) => saleIds.has(i.saleId));
  const itemMap = {};
  for (const it of items) {
    if (!itemMap[it.name]) itemMap[it.name] = { name: it.name, qty: 0, unit: it.unit, revenue: 0 };
    itemMap[it.name].qty += it.qty;
    itemMap[it.name].revenue += it.lineTotal || it.qty * it.price;
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Expenses
  const expenses = await db.expenses.where("shopId").equals(shopId).toArray();
  const todayExpenses = expenses.filter((e) => e.ts >= dayStart && e.ts < dayEnd);
  const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0);

  // Wastage
  const wastage = await db.wastage.where("shopId").equals(shopId).toArray();
  const todayWastage = wastage.filter((w) => w.ts >= dayStart && w.ts < dayEnd);
  const totalWastage = todayWastage.reduce((s, w) => s + (w.costValue || 0), 0);

  // Pending orders
  const orders = await db.orders.where("shopId").equals(shopId).toArray();
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "ready");

  // Low stock
  const stocks = await db.shopStock.where("shopId").equals(shopId).toArray();
  const products = await db.products.toArray();
  const productById = {};
  for (const p of products) productById[p.id] = p;

  const lowStock = stocks
    .filter((s) => s.stock <= (s.lowStock || 0))
    .map((s) => ({
      ...productById[s.productId],
      stock: s.stock,
      lowStock: s.lowStock,
    }))
    .filter((p) => p && p.name);

  // Cash drawer
  const drawer = await db.cashDrawer
    .where("[shopId+date]")
    .equals([shopId, date])
    .first();

  return {
    date,
    shopId,
    billCount: todaySales.length,
    totalSales,
    totalDiscount,
    payment,
    topItems,
    totalExpenses,
    expenseCount: todayExpenses.length,
    totalWastage,
    pendingOrders: pendingOrders.length,
    pendingOrderDetails: pendingOrders.slice(0, 5),
    lowStock: lowStock.slice(0, 10),
    lowStockCount: lowStock.length,
    drawer,
  };
}

// Format summary as text for WhatsApp
export async function formatSummaryText({ shopId, date }) {
  const shops = await db.settings.get("shops");
  const shop = shops?.value?.find((s) => s.id === shopId);
  const s = await buildDayEndSummary({ shopId, date });

  const lines = [];
  lines.push(`*${shop?.name || shopId}*`);
  lines.push(`📅 ${new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`);
  lines.push("");
  lines.push(`*💰 SALES*`);
  lines.push(`Total: ₹${s.totalSales.toFixed(2)}`);
  lines.push(`Bills: ${s.billCount}`);
  lines.push(`Avg: ₹${(s.billCount ? s.totalSales / s.billCount : 0).toFixed(2)}`);
  lines.push("");
  lines.push(`*💳 PAYMENTS*`);
  lines.push(`Cash: ₹${s.payment.cash.toFixed(2)}`);
  lines.push(`UPI: ₹${s.payment.upi.toFixed(2)}`);
  lines.push(`Card: ₹${s.payment.card.toFixed(2)}`);
  lines.push("");

  if (s.topItems.length > 0) {
    lines.push(`*🏆 TOP ITEMS*`);
    s.topItems.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.name} — ${it.qty.toFixed(2)} ${it.unit} (₹${it.revenue.toFixed(0)})`);
    });
    lines.push("");
  }

  if (s.totalExpenses > 0) {
    lines.push(`*📝 EXPENSES*`);
    lines.push(`Total: ₹${s.totalExpenses.toFixed(2)} (${s.expenseCount} entries)`);
    lines.push("");
  }

  if (s.totalWastage > 0) {
    lines.push(`*🗑️ WASTAGE*`);
    lines.push(`Cost loss: ₹${s.totalWastage.toFixed(2)}`);
    lines.push("");
  }

  if (s.drawer?.openingCash !== undefined && s.drawer?.closingCash !== null) {
    lines.push(`*💵 CASH DRAWER*`);
    lines.push(`Opening: ₹${s.drawer.openingCash.toFixed(2)}`);
    lines.push(`Expected: ₹${s.drawer.expectedCash?.toFixed(2)}`);
    lines.push(`Actual: ₹${s.drawer.closingCash.toFixed(2)}`);
    const diff = s.drawer.difference;
    if (Math.abs(diff) < 0.01) {
      lines.push(`Difference: ₹0 ✅`);
    } else {
      lines.push(`Difference: ₹${diff.toFixed(2)} ${diff > 0 ? "⬆️" : "⬇️"}`);
    }
    lines.push("");
  }

  if (s.pendingOrders > 0) {
    lines.push(`*⏰ PENDING ORDERS*`);
    lines.push(`${s.pendingOrders} order${s.pendingOrders > 1 ? "s" : ""} awaiting delivery`);
    lines.push("");
  }

  if (s.lowStockCount > 0) {
    lines.push(`*⚠️ LOW STOCK (${s.lowStockCount})*`);
    s.lowStock.slice(0, 5).forEach((p) => {
      lines.push(`• ${p.name}: ${p.stock} ${p.unit}`);
    });
    if (s.lowStockCount > 5) lines.push(`+ ${s.lowStockCount - 5} more`);
    lines.push("");
  }

  lines.push(`_Rozy POS · Automated summary_`);
  return lines.join("\n");
}

export function todayKeyForUI() {
  return todayKey();
}