import { saveSale } from "./billing";
import { nextBillNumber } from "./billing";

import { db } from "./db";

// ============ CUSTOMERS ============

export async function addCustomer({ name, phone, address, notes, birthday }) {
  const now = Date.now();
  return await db.customers.add({
    name: name.trim(),
    phone: (phone || "").trim(),
    address: (address || "").trim(),
    notes: (notes || "").trim(),
    birthday: birthday || null,
    createdAt: now,
    totalSpent: 0,
    totalOrders: 0,
    lastVisit: now,
  });
}

export async function updateCustomer(id, data) {
  return await db.customers.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteCustomer(id) {
  return await db.customers.delete(id);
}

export async function getAllCustomers() {
  const list = await db.customers.toArray();
  return list.sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
}

export async function findCustomerByPhone(phone) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  const all = await db.customers.toArray();
  return all.find((c) => c.phone.replace(/\D/g, "").endsWith(clean)) || null;
}

export async function searchCustomers(query) {
  const all = await db.customers.toArray();
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
  const sales = await db.sales.toArray();
  const customerSales = sales.filter((s) => s.customerId === customerId);
  const orders = await db.orders.toArray();
  const customerOrders = orders.filter((o) => o.customerId === customerId);

  const totalSpent = customerSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalBills = customerSales.length;
  const avgBill = totalBills > 0 ? totalSpent / totalBills : 0;

  // Favorite items
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

  // Last purchase date
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
  const sales = await db.sales.toArray();
  const mySales = sales
    .filter((s) => s.customerId === customerId)
    .sort((a, b) => b.ts - a.ts);
  return mySales;
}

// ============ ORDERS (Advance Bookings) ============

export async function createOrder({
  customerId,
  customerName,
  customerPhone,
  items,
  deliveryDate,
  notes,
  orderType, // "pickup" | "delivery"
  address,
  advanceAmount,
  totalAmount,
  user,
}) {
  const now = Date.now();
  const orderNo = `ORD-${now.toString().slice(-6)}`;

  const orderId = await db.orders.add({
    orderNo,
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
    status: "pending", // pending | ready | delivered | cancelled
    createdAt: now,
    createdBy: user || "system",
  });

  // Log advance payment if any
  if (advanceAmount > 0) {
    await db.payments.add({
      orderId,
      ts: now,
      type: "advance",
      amount: advanceAmount,
      note: "Advance at booking",
    });
  }

  await db.auditLog.add({
    ts: now,
    user: user || "system",
    action: "ORDER_CREATED",
    entity: "order",
    entityId: orderId,
    details: { orderNo, totalAmount, advanceAmount },
  });

  return { orderId, orderNo };
}

export async function updateOrder(orderId, data) {
  return await db.orders.update(orderId, { ...data, updatedAt: Date.now() });
}

export async function updateOrderStatus(orderId, status, user) {
  const now = Date.now();
  await db.orders.update(orderId, { status, updatedAt: now });

  await db.auditLog.add({
    ts: now,
    user: user || "system",
    action: "ORDER_STATUS_CHANGED",
    entity: "order",
    entityId: orderId,
    details: { status },
  });
}

export async function recordOrderPayment(orderId, amount, type = "balance", user) {
  const order = await db.orders.get(orderId);
  if (!order) return;

  const now = Date.now();
  const newPaid = (order.advanceAmount || 0) + amount;

  await db.orders.update(orderId, {
    advanceAmount: newPaid,
    balanceAmount: Math.max(0, order.totalAmount - newPaid),
    updatedAt: now,
  });

  await db.payments.add({
    orderId,
    ts: now,
    type,
    amount,
    note: type === "balance" ? "Balance payment" : "Additional payment",
  });
}

export async function deleteOrder(orderId) {
  await db.orders.delete(orderId);
  const payments = await db.payments.where("orderId").equals(orderId).toArray();
  for (const p of payments) {
    await db.payments.delete(p.id);
  }
}

export async function getAllOrders({ status, from, to } = {}) {
  let all = await db.orders.toArray();
  if (status && status !== "all") {
    all = all.filter((o) => o.status === status);
  }
  if (from) all = all.filter((o) => o.createdAt >= from);
  if (to) all = all.filter((o) => o.createdAt <= to);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrdersByCustomer(customerId) {
  const all = await db.orders.toArray();
  return all
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrderStats() {
  const all = await db.orders.toArray();
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
// ============ COMPLETE ORDER (Auto-Bill on Delivery) ============

export async function completeOrder({
  orderId,
  paymentAmount,      // total cash/upi/card collected NOW (balance)
  paymentMode = "Cash",
  counter = "Rozy",
  user,
}) {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "delivered") throw new Error("Order already delivered");

  const now = Date.now();

  // Generate bill number (RZ-0001 / WR-0001)
  const prefix = counter === "Rozy" ? "RZ" : counter === "Warish" ? "WR" : "GN";
  const seqKey = `billSeq_${counter}`;
  const rec = await db.settings.get(seqKey);
  const next = (rec?.value || 0) + 1;
  await db.settings.put({ key: seqKey, value: next });
  const billNo = `${prefix}-${String(next).padStart(4, "0")}`;

  // Build sale record from order
  const totalPaid = (order.advanceAmount || 0) + (paymentAmount || 0);
  const change = Math.max(0, totalPaid - order.totalAmount);

  const saleId = await db.sales.add({
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
    note: `From order ${order.orderNo}`,
  });

  // Save sale items + deduct stock
  for (const it of order.items) {
    await db.saleItems.add({
      saleId,
      productId: it.productId,
      name: it.productName,
      product_name: it.productName,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      lineTotal: it.lineTotal,
    });

    // Deduct stock
    const product = await db.products.get(it.productId);
    if (product) {
      const newStock = Math.max(0, (product.stock || 0) - it.qty);
      await db.products.update(it.productId, {
        stock: newStock,
        updatedAt: now,
      });

      // Log stock movement
      await db.stockMovements.add({
        ts: now,
        productId: it.productId,
        productName: it.productName,
        qty: -it.qty,
        unit: it.unit,
        reason: "sale",
        note: `Order ${order.orderNo} delivered`,
        cost: product.cost || 0,
        user: user || "system",
        balanceAfter: newStock,
      });
    }
  }

  // Record balance payment
  if (paymentAmount > 0) {
    await db.payments.add({
      orderId,
      ts: now,
      type: "balance",
      amount: paymentAmount,
      note: `Paid at delivery · ${paymentMode}`,
    });
  }

  // Update order status
  await db.orders.update(orderId, {
    status: "delivered",
    deliveredAt: now,
    deliveredBy: user || "system",
    billNo,
    saleId,
    balanceAmount: 0,
    updatedAt: now,
  });

  // Update customer lifetime value
  if (order.customerId) {
    const cust = await db.customers.get(order.customerId);
    if (cust) {
      await db.customers.update(order.customerId, {
        totalSpent: (cust.totalSpent || 0) + order.totalAmount,
        totalOrders: (cust.totalOrders || 0) + 1,
        lastVisit: now,
      });
    }
  }

  // Audit
  await db.auditLog.add({
    ts: now,
    user: user || "system",
    action: "ORDER_COMPLETED",
    entity: "order",
    entityId: orderId,
    details: { orderNo: order.orderNo, billNo, totalPaid, paymentMode },
  });

  return { billNo, saleId, change };
}