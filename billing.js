import { db, getDeviceTag } from "./db";
import { pushRecord } from "./syncEngine";
import { netCash, isRefund } from "./money";
import { evaluatePayment } from "./paymentRules";
import { computeRefund } from "./refundRules";
import { applyStockChange } from "./inventory";
import { localDateKey } from "./dates";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============ SAVE SALE ============
// All local writes happen inside ONE database transaction, so a crash, a closed tab or a
// dead battery can never leave a bill without its items, a used bill number with no sale,
// or stock deducted for a sale that was not saved. Cloud pushes happen after it commits.

export async function saveSale({
  shopId,
  cashier,
  items,
  subtotal,
  discount,
  total,
  payment: paymentInput,
  customer,
}) {
  let payment = paymentInput;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot save an empty bill");
  }
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("Invalid bill total");
  }

  // The payment must cover the bill and reconcile (cash kept + UPI + card = total).
  const check = evaluatePayment({
    mode: payment?.mode,
    cash: payment?.cash,
    upi: payment?.upi,
    card: payment?.card,
    total,
  });
  if (!check.ok) throw new Error(check.error || "The payment does not cover the bill");
  payment = check.payment;

  const shop = shopId || getCurrentShopId();
  const ts = Date.now();
  const pushes = [];
  let saleId;
  let billNo;

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.shopStock, db.stockMovements, db.auditLog, db.settings, db.cashDrawer],
    async () => {
      // Once the owner/cashier has closed the cash day, no more bills until it is reopened
      const drawer = await db.cashDrawer.where("[shopId+date]").equals([shop, localDateKey()]).first();
      if (drawer?.closedAt) {
        throw new Error("Today's cash day is closed. Ask the owner to reopen it before billing.");
      }

      billNo = await nextBillNumber(shop);

      saleId = await db.sales.add({
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

      await db.saleItems.bulkAdd(
        items.map((it) => ({
          saleId,
          productId: it.id,
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          price: it.price,
          lineTotal: it.qty * it.price,
          variant: it.variant || null,
        }))
      );

      pushes.push([
        "sales",
        {
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
        },
      ]);

      // Deduct stock from THIS shop's shopStock
      for (const it of items) {
        const existing = await db.shopStock
          .where("[shopId+productId]")
          .equals([shop, it.id])
          .first();
        if (!existing) continue;

        const newStock = Math.max(0, (existing.stock || 0) - it.qty);
        await db.shopStock.update(existing.id, { stock: newStock, updatedAt: ts });

        pushes.push([
          "shopStock",
          {
            id: existing.id,
            shopId: shop,
            productId: it.id,
            stock: newStock,
            lowStock: existing.lowStock || 5,
            updatedAt: ts,
          },
        ]);

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

      await db.auditLog.add({
        shopId: shop,
        ts,
        userName: cashier || "system",
        action: "SALE_CREATED",
        entity: "sale",
        entityId: saleId,
        details: { billNo, total, shopId: shop },
      });
    }
  );

  // Cloud push happens AFTER the local commit; failures are queued by pushRecord.
  for (const [table, record] of pushes) {
    pushRecord(table, record).catch(() => {});
  }

  import("../stores/syncStore")
    .then(({ useSync }) => useSync.getState().sync())
    .catch(() => {});

  return { saleId, billNo, ts };
}

// ============ REFUND / RETURN ============
// A refund is stored as its own bill with NEGATIVE amounts and quantities, linked to the original
// bill (payment.refundOf). The original bill is never edited or deleted, so the history stays
// complete and every report (sales, cash, profit, items) nets out automatically.

export async function getRefundsForSale(saleId) {
  const sale = await db.sales.get(saleId);
  if (!sale) return [];
  const shop = sale.shopId || sale.counter;
  const refunds = await db.sales
    .where("shopId").equals(shop)
    .filter((s) => s.payment?.refundOf === saleId)
    .toArray();
  const out = [];
  for (const r of refunds) {
    const items = await db.saleItems.where("saleId").equals(r.id).toArray();
    out.push({ ...r, items });
  }
  return out;
}

export async function saveRefund({ saleId, selections, method, reason, restock, user, approvedBy }) {
  if (!["Cash", "UPI", "Card"].includes(method)) throw new Error("Choose how the money is returned");
  if (!reason || !reason.trim()) throw new Error("Enter a reason for the refund");

  const pushes = [];
  let result;

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.products, db.shopStock, db.stockMovements, db.auditLog, db.settings, db.cashDrawer],
    async () => {
      const sale = await db.sales.get(saleId);
      if (!sale) throw new Error("Bill not found");
      if (isRefund(sale)) throw new Error("A refund bill cannot be refunded again");

      const shop = sale.shopId || sale.counter;
      const ts = Date.now();

      const drawer = await db.cashDrawer.where("[shopId+date]").equals([shop, localDateKey()]).first();
      if (drawer?.closedAt) {
        throw new Error("Today's cash day is closed. Ask the owner to reopen it before refunding.");
      }

      const items = await db.saleItems.where("saleId").equals(saleId).toArray();
      const earlier = await db.sales
        .where("shopId").equals(shop)
        .filter((s) => s.payment?.refundOf === saleId)
        .toArray();
      const priorRefunds = [];
      for (const r of earlier) {
        priorRefunds.push({
          total: r.total,
          items: await db.saleItems.where("saleId").equals(r.id).toArray(),
        });
      }

      const calc = computeRefund({ sale, saleItems: items, priorRefunds, selections });
      if (!calc.ok) throw new Error(calc.error);
      const total = calc.total;

      const seqKey = `refundSeq_${shop}`;
      const seqRec = await db.settings.get(seqKey);
      const seq = (seqRec?.value || 0) + 1;
      await db.settings.put({ key: seqKey, value: seq });
      const billNo = `RF-${getDeviceTag()}-${String(seq).padStart(4, "0")}`;

      const payment = {
        mode: "Refund",
        refundOf: saleId,
        originalBillNo: sale.billNo,
        method,
        cash: method === "Cash" ? -total : 0,
        upi: method === "UPI" ? -total : 0,
        card: method === "Card" ? -total : 0,
        paid: -total,
        change: 0,
        reason: reason.trim(),
        restock: !!restock,
        approvedBy: approvedBy || user || null,
      };

      const refundId = await db.sales.add({
        shopId: shop,
        billNo,
        counter: shop,
        cashier: user,
        ts,
        subtotal: -total,
        discount: 0,
        total: -total,
        payment,
        customer: null,
        customerId: sale.customerId || null,
        customerName: sale.customerName || null,
        customerPhone: sale.customerPhone || null,
        channel: "refund",
        source: "refund",
        tax: 0,
        updatedAt: ts,
      });

      await db.saleItems.bulkAdd(
        calc.lines.map((l) => ({
          saleId: refundId,
          productId: l.productId,
          name: l.name,
          unit: l.unit,
          qty: -l.qty,
          price: l.price,
          lineTotal: -l.amount,
          variant: l.variant,
        }))
      );

      pushes.push([
        "sales",
        {
          id: refundId, shopId: shop, billNo, ts, cashier: user,
          subtotal: -total, discount: 0, tax: 0, total: -total, payment,
          customerId: sale.customerId || null,
          customerName: sale.customerName || null,
          customerPhone: sale.customerPhone || null,
          channel: "refund", source: "refund", updatedAt: ts, createdAt: ts,
        },
      ]);

      // Put the goods back into THIS shop's stock (only when the owner says they are resellable)
      if (restock) {
        for (const l of calc.lines) {
          const product = await db.products.get(l.productId);
          if (!product) continue;
          const r = await applyStockChange({
            shopId: shop,
            product,
            qty: l.qty,
            reason: "return",
            note: `Refund ${billNo} of ${sale.billNo}`,
            user,
          });
          pushes.push(r.push);
        }
      }

      await db.auditLog.add({
        shopId: shop,
        ts,
        userName: user || "system",
        action: "REFUND_CREATED",
        entity: "sale",
        entityId: refundId,
        details: {
          billNo, originalBillNo: sale.billNo, total, method,
          reason: reason.trim(), restock: !!restock, approvedBy: approvedBy || user,
        },
      });

      result = { refundId, billNo, total };
    }
  );

  for (const [table, record] of pushes) {
    pushRecord(table, record).catch(() => {});
  }
  import("../stores/syncStore")
    .then(({ useSync }) => useSync.getState().sync())
    .catch(() => {});

  return result;
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
  return `${prefix}-${getDeviceTag()}-${String(next).padStart(4, "0")}`;
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
    ? all.filter((s) => (s.shopId || s.counter) === counter)
    : all;

  const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const count = sales.filter((s) => !isRefund(s)).length;
  const cash = sales.reduce((sum, s) => sum + netCash(s), 0);
  const upi = sales.reduce((sum, s) => sum + (s.payment?.upi || 0), 0);
  const card = sales.reduce((sum, s) => sum + (s.payment?.card || 0), 0);

  return { total, count, cash, upi, card };
}