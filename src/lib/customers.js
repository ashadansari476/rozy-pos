import { db, getDeviceTag } from "./db";
import { pushRecord } from "./syncEngine";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============ CUSTOMERS ============

export async function addCustomer({ name, phone, address, notes, birthday }) {
  const now = Date.now();
  const shopId = getCurrentShopId();
  const id = await db.customers.add({
    shopId,
    name: name.trim(),
    phone: (phone || "").trim(),
    address: (address || "").trim(),
    notes: (notes || "").trim(),
    birthday: birthday || null,
    createdAt: now,
    updatedAt: now,
    totalSpent: 0,
    totalOrders: 0,
    lastVisit: now,
  });

  pushRecord("customers", {
    id,
    shopId,
    name: name.trim(),
    phone: (phone || "").trim(),
    address: (address || "").trim(),
    notes: (notes || "").trim(),
    birthday: birthday || null,
    createdAt: now,
    updatedAt: now,
    totalSpent: 0,
    totalOrders: 0,
    lastVisit: now,
  }).catch(() => {});

  return id;
}

export async function updateCustomer(id, data) {
  const now = Date.now();
  const existing = await db.customers.get(id);
  if (!existing) return 0;
  const shopId = existing.shopId || getCurrentShopId();
  const safeData = { ...data, shopId, updatedAt: now };
  const result = await db.customers.update(id, safeData);
  pushRecord("customers", { id, ...existing, ...safeData }).catch(() => {});
  return result;
}

export async function deleteCustomer(id) {
  return await db.customers.delete(id);
}

export async function getAllCustomers() {
  const list = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  return list.sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
}

export async function findCustomerByPhone(phone) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  const all = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  return all.find((c) => (c.phone || "").replace(/\D/g, "").endsWith(clean)) || null;
}

export async function searchCustomers(query) {
  const all = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  if (!query) return all;
  const q = query.toLowerCase().trim();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
  );
}

// ============ CUSTOMER STATS ============

export async function getCustomerStats(customerId) {
  const shopId = getCurrentShopId();
  const [sales, orders] = await Promise.all([
    db.sales.where("shopId").equals(shopId).toArray(),
    db.orders.where("shopId").equals(shopId).toArray(),
  ]);
  const customerSales = sales.filter((s) => s.customerId === customerId);
  const customerOrders = orders.filter((o) => o.customerId === customerId);

  const totalSpent = customerSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalBills = customerSales.length;
  const avgBill = totalBills > 0 ? totalSpent / totalBills : 0;

  const saleIds = new Set(customerSales.map((s) => s.id));
  const items = await db.saleItems.toArray();
  const myItems = items.filter((i) => saleIds.has(i.saleId));
  const itemCount = {};
  for (const it of myItems) {
    itemCount[it.name] = (itemCount[it.name] || 0) + it.qty;
  }
  const favorites = Object.entries(itemCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const lastSale = customerSales.sort((a, b) => b.ts - a.ts)[0];

  return {
    totalSpent,
    totalBills,
    avgBill,
    totalOrders: customerOrders.length,
    favorites,
    lastPurchase: lastSale?.ts || null,
  };
}

export async function getCustomerHistory(customerId) {
  const sales = await db.sales.where("shopId").equals(getCurrentShopId()).toArray();
  const mySales = sales
    .filter((s) => s.customerId === customerId)
    .sort((a, b) => b.ts - a.ts);
  return mySales;
}

// ============ ORDERS ============

export async function createOrder({
  customerId,
  customerName,
  customerPhone,
  items,
  deliveryDate,
  notes,
  orderType,
  address,
  advanceAmount,
  totalAmount,
  user,
  channel,
  source,
}) {
  const now = Date.now();
  const orderSeqRec = await db.settings.get("orderSeq");
  const orderSeq = (orderSeqRec?.value || 0) + 1;
  await db.settings.put({ key: "orderSeq", value: orderSeq });
  const orderNo = `ORD-${getDeviceTag()}-${String(orderSeq).padStart(4, "0")}`;
  const shopId = getCurrentShopId();

  const orderId = await db.orders.add({
    orderNo,
    shopId,
    customerId: customerId || null,
    customerName: customerName || "Walk-in",
    customerPhone: customerPhone || "",
    items: items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      lineTotal: it.qty * it.price,
    })),
    totalAmount,
    advanceAmount: advanceAmount || 0,
    balanceAmount: totalAmount - (advanceAmount || 0),
    deliveryDate: deliveryDate ? new Date(deliveryDate).getTime() : now,
    notes: notes || "",
    orderType: orderType || "pickup",
    address: address || "",
    status: "pending",
    channel: channel || "pos",
    source: source || "pos",
    createdAt: now,
    createdAtTs: now,
    createdBy: user || "system",
    updatedAt: now,
  });

  if (advanceAmount > 0) {
    await db.payments.add({
      shopId,
      orderId,
      ts: now,
      type: "advance",
      amount: advanceAmount,
      note: "Advance at booking",
    });
  }

  await db.auditLog.add({
    shopId,
    ts: now,
    userName: user || "system",
    action: "ORDER_CREATED",
    entity: "order",
    entityId: orderId,
    details: { orderNo, totalAmount, advanceAmount },
  });

  pushRecord("orders", {
    id: orderId,
    shopId,
    orderNo,
    customerId: customerId || null,
    customerName: customerName || "Walk-in",
    customerPhone: customerPhone || "",
    totalAmount,
    advanceAmount: advanceAmount || 0,
    balanceAmount: totalAmount - (advanceAmount || 0),
    deliveryDate: deliveryDate ? new Date(deliveryDate).getTime() : now,
    notes: notes || "",
    orderType: orderType || "pickup",
    address: address || "",
    status: "pending",
    channel: channel || "pos",
    source: source || "pos",
    createdAtTs: now,
    createdBy: user || "system",
    updatedAt: now,
  }).catch(() => {});

  import("../stores/syncStore").then(({ useSync }) => {
    useSync.getState().sync();
  }).catch(() => {});

  return { orderId, orderNo };
}

export async function updateOrder(orderId, data) {
  const existing = await db.orders.get(orderId);
  if (!existing) throw new Error("Order not found");
  if (existing.shopId && existing.shopId !== getCurrentShopId()) {
    throw new Error("Cannot update an order belonging to another shop");
  }
  const updatedAt = Date.now();
  const updated = { ...existing, ...data, shopId: existing.shopId || getCurrentShopId(), updatedAt };
  await db.orders.update(orderId, updated);
  pushRecord("orders", updated).catch(() => {});
  return 1;
}

export async function updateOrderStatus(orderId, status, user) {
  const now = Date.now();
  const shopId = getCurrentShopId();
  const existing = await db.orders.get(orderId);
  if (!existing) throw new Error("Order not found");
  if (existing.shopId && existing.shopId !== shopId) {
    throw new Error("Cannot update an order belonging to another shop");
  }

  const updated = { ...existing, shopId, status, updatedAt: now };
  await db.transaction("rw", [db.orders, db.auditLog], async () => {
    await db.orders.put(updated);
    await db.auditLog.add({
      shopId,
      ts: now,
      userName: user || "system",
      action: "ORDER_STATUS_CHANGED",
      entity: "order",
      entityId: orderId,
      details: { status },
    });
  });

  pushRecord("orders", updated).catch(() => {});
}

export async function recordOrderPayment(orderId, amount, type = "balance", user) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be a positive number");
  }
  const order = await db.orders.get(orderId);
  if (!order) throw new Error("Order not found");

  const shopId = getCurrentShopId();
  if (order.shopId && order.shopId !== shopId) {
    throw new Error("Cannot record payment for another shop's order");
  }

  const outstanding = Math.max(0, Number(order.totalAmount) - Number(order.advanceAmount || 0));
  if (amount > outstanding) {
    throw new Error(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`);
  }

  const now = Date.now();
  const updatedOrder = {
    ...order,
    shopId: order.shopId || shopId,
    advanceAmount: (order.advanceAmount || 0) + amount,
    balanceAmount: Math.max(0, order.totalAmount - (order.advanceAmount || 0) - amount),
    updatedAt: now,
  };
  let paymentId;

  // The order balance and payment ledger must not diverge if one write fails.
  await db.transaction("rw", [db.orders, db.payments, db.auditLog], async () => {
    await db.orders.put(updatedOrder);
    paymentId = await db.payments.add({
      shopId,
      orderId,
      ts: now,
      type,
      amount,
      userName: user || "system",
      note: type === "balance" ? "Balance payment" : "Additional payment",
    });
    await db.auditLog.add({
      shopId,
      ts: now,
      userName: user || "system",
      action: "ORDER_PAYMENT_RECORDED",
      entity: "order",
      entityId: orderId,
      details: { amount, type, paymentId },
    });
  });

  pushRecord("orders", updatedOrder).catch(() => {});
  pushRecord("payments", {
    id: paymentId,
    shopId,
    orderId,
    ts: now,
    type,
    amount,
    userName: user || "system",
    note: type === "balance" ? "Balance payment" : "Additional payment",
  }).catch(() => {});
}

export async function deleteOrder(orderId) {
  await db.orders.delete(orderId);
  const payments = await db.payments.where("orderId").equals(orderId).toArray();
  for (const p of payments) {
    await db.payments.delete(p.id);
  }
}

export async function getAllOrders({ status, from, to } = {}) {
  let all = await db.orders.where("shopId").equals(getCurrentShopId()).toArray();
  if (status && status !== "all") {
    all = all.filter((o) => o.status === status);
  }
  if (from) all = all.filter((o) => o.createdAt >= from);
  if (to) all = all.filter((o) => o.createdAt <= to);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrdersByCustomer(customerId) {
  const all = await db.orders.where("shopId").equals(getCurrentShopId()).toArray();
  return all
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrderStats() {
  const all = await db.orders.where("shopId").equals(getCurrentShopId()).toArray();
  const now = Date.now();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const pending = all.filter((o) => o.status === "pending");
  const ready = all.filter((o) => o.status === "ready");
  const today = all.filter(
    (o) => o.deliveryDate >= startOfDay && o.deliveryDate <= endOfDay
  );
  const overdue = pending.filter((o) => o.deliveryDate < now);

  const totalPendingAmount = pending.reduce((s, o) => s + (o.balanceAmount || 0), 0);

  return {
    total: all.length,
    pending: pending.length,
    ready: ready.length,
    today: today.length,
    overdue: overdue.length,
    totalPendingAmount,
    pendingOrders: pending,
    readyOrders: ready,
    todayOrders: today,
    overdueOrders: overdue,
  };
}

// ============ COMPLETE ORDER ============

export async function completeOrder({
  orderId,
  paymentAmount,
  paymentMode = "Cash",
  counter = "Rozy",
  user,
}) {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "delivered") throw new Error("Order already delivered");

  const now = Date.now();
  const shopId = counter.toLowerCase();

  const prefix = counter === "Rozy" ? "RZ" : counter === "Warish" ? "WR" : "GN";
  const seqKey = `billSeq_${counter}`;
  const rec = await db.settings.get(seqKey);
  const next = (rec?.value || 0) + 1;
  await db.settings.put({ key: seqKey, value: next });
  const billNo = `${prefix}-${String(next).padStart(4, "0")}`;

  const totalPaid = (order.advanceAmount || 0) + (paymentAmount || 0);
  const change = Math.max(0, totalPaid - order.totalAmount);

  const saleId = await db.sales.add({
    shopId,
    billNo,
    counter,
    cashier: user || "system",
    ts: now,
    subtotal: order.totalAmount,
    discount: 0,
    total: order.totalAmount,
    payment: {
      mode: paymentMode,
      cash: paymentMode === "Cash" ? totalPaid : 0,
      upi: paymentMode === "UPI" ? totalPaid : 0,
      card: paymentMode === "Card" ? totalPaid : 0,
      paid: totalPaid,
      change,
    },
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fromOrderId: orderId,
    channel: order.channel || "pos",
    source: order.source || "pos",
    note: `From order ${order.orderNo}`,
    updatedAt: now,
  });

  for (const it of order.items) {
    await db.saleItems.add({
      saleId,
      productId: it.productId,
      name: it.productName,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      lineTotal: it.lineTotal,
    });

    // Deduct from shopStock
    const existing = await db.shopStock
      .where("[shopId+productId]")
      .equals([shopId, it.productId])
      .first();

    if (existing) {
      const newStock = Math.max(0, (existing.stock || 0) - it.qty);
      await db.shopStock.update(existing.id, { stock: newStock });

      await db.stockMovements.add({
        shopId,
        ts: now,
        productId: it.productId,
        productName: it.productName,
        qty: -it.qty,
        unit: it.unit,
        reason: "sale",
        note: `Order ${order.orderNo} delivered`,
        cost: it.cost || 0,
        userName: user || "system",
        balanceAfter: newStock,
      });
    }
  }

  if (paymentAmount > 0) {
    await db.payments.add({
      shopId,
      orderId,
      ts: now,
      type: "balance",
      amount: paymentAmount,
      note: `Paid at delivery · ${paymentMode}`,
    });
  }

  await db.orders.update(orderId, {
    status: "delivered",
    deliveredAt: now,
    deliveredBy: user || "system",
    billNo,
    saleId,
    balanceAmount: 0,
    updatedAt: now,
  });

  if (order.customerId) {
    const cust = await db.customers.get(order.customerId);
    if (cust) {
      await db.customers.update(order.customerId, {
        totalSpent: (cust.totalSpent || 0) + order.totalAmount,
        totalOrders: (cust.totalOrders || 0) + 1,
        lastVisit: now,
        updatedAt: now,
      });
    }
  }

  await db.auditLog.add({
    shopId,
    ts: now,
    userName: user || "system",
    action: "ORDER_COMPLETED",
    entity: "order",
    entityId: orderId,
    details: { orderNo: order.orderNo, billNo, totalPaid, paymentMode },
  });

  import("../stores/syncStore").then(({ useSync }) => {
    useSync.getState().sync();
  }).catch(() => {});

  return { billNo, saleId, change };
}