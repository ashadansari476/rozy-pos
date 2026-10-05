import { db } from "./db";
import { pushRecord } from "./syncEngine";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============ SAVE SALE ============

export async function saveSale({
  shopId,
  cashier,
  items,
  subtotal,
  discount,
  total,
  payment,
  customer,
}) {
  const shop = shopId || getCurrentShopId();
  const billNo = await nextBillNumber(shop);
  const ts = Date.now();

  const saleId = await db.sales.add({
    shopId: shop,
    billNo,
    counter: shop,
    cashier,
    ts,
    subtotal,
    discount,
    total,
    payment,
    customer: customer || null,
    customerId: customer?.id || null,
    customerName: customer?.name || null,
    customerPhone: customer?.phone || null,
    channel: customer?.channel || "pos",
    source: "pos",
    tax: 0,
    updatedAt: ts,
  });

  const saleItems = items.map((it) => ({
    saleId,
    productId: it.id,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    price: it.price,
    lineTotal: it.qty * it.price,
    variant: it.variant || null,
  }));
  await db.saleItems.bulkAdd(saleItems);

  // Push sale to cloud
  pushRecord("sales", {
    id: saleId,
    shopId: shop,
    billNo,
    ts,
    cashier,
    subtotal,
    discount,
    tax: 0,
    total,
    payment,
    customerId: customer?.id || null,
    customerName: customer?.name || null,
    customerPhone: customer?.phone || null,
    channel: customer?.channel || "pos",
    source: "pos",
    updatedAt: ts,
    createdAt: ts,
  }).catch(() => {});

  // Deduct stock from THIS shop's stock (shopStock table)
  for (const it of items) {
    const existing = await db.shopStock
      .where("[shopId+productId]")
      .equals([shop, it.id])
      .first();
    if (existing) {
      const newStock = Math.max(0, (existing.stock || 0) - it.qty);
      await db.shopStock.update(existing.id, { stock: newStock });

      // Log stock movement — WITH shopId and userName
      await db.stockMovements.add({
        shopId: shop,
        ts,
        productId: it.id,
        productName: it.name,
        qty: -it.qty,
        unit: it.unit,
        reason: "sale",
        note: `Sale ${billNo}`,
        cost: it.cost || 0,
        userName: cashier || "system",
        balanceAfter: newStock,
      });
    }
  }

  // Audit log — WITH shopId and userName
  await db.auditLog.add({
    shopId: shop,
    ts,
    userName: cashier || "system",
    action: "SALE_CREATED",
    entity: "sale",
    entityId: saleId,
    details: { billNo, total, shopId: shop },
  });

  // Trigger sync
  import("../stores/syncStore").then(({ useSync }) => {
    useSync.getState().sync();
  }).catch(() => {});

  return { saleId, billNo, ts };
}

// ============ BILL NUMBER ============

export async function nextBillNumber(shopId) {
  const shopsRec = await db.settings.get("shops");
  const shop = shopsRec?.value?.find((s) => s.id === shopId);
  const prefix = shop?.billPrefix || (shopId === "rozy" ? "RZ" : "WR");

  const key = `billSeq_${shopId}`;
  const rec = await db.settings.get(key);
  const next = (rec?.value || 0) + 1;
  await db.settings.put({ key, value: next });
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

// ============ STATS ============

export async function getRecentSales(counter, limit = 20) {
  let sales = await db.sales.orderBy("ts").reverse().toArray();
  if (counter && counter !== "Both") {
    sales = sales.filter((s) => s.counter === counter);
  }
  return sales.slice(0, limit);
}

export async function getTodayStats(counter) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();

  const all = await db.sales.where("ts").aboveOrEqual(startTs).toArray();
  const sales = counter && counter !== "Both"
    ? all.filter((s) => s.counter === counter)
    : all;

  const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const count = sales.length;
  const cash = sales.reduce((sum, s) => sum + (s.payment?.cash || 0), 0);
  const upi = sales.reduce((sum, s) => sum + (s.payment?.upi || 0), 0);
  const card = sales.reduce((sum, s) => sum + (s.payment?.card || 0), 0);

  return { total, count, cash, upi, card };
}