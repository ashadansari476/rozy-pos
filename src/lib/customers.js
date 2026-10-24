import { db, getDeviceTag } from "./db";
import { pushRecord, isSyncConfigured, queueOperation, processQueue } from "./syncEngine";
import { validateNewOrder } from "./orderRules";
import { validateDeliverySettlement, validateDeliveryStock } from "./orderDeliveryRules";
import { nextBillNumber } from "./billing";

// Helper — get current shop ID
function getCurrentShopId() {
  const shop = localStorage.getItem("rozy-pos-current-shop");
  if (shop !== "rozy" && shop !== "warish") throw new Error("Select a valid bakery");
  return shop;
}

async function queueSavedChanges(changes) {
  if (!isSyncConfigured()) return;
  for (const { table, id } of changes) {
    if (id == null) continue;
    const record = await db.table(table).get(id);
    if (record) await queueOperation(table, id, "upsert", record);
  }
  processQueue().catch((err) => console.error("Cloud sync changes remain queued", err));
}

// ============ CUSTOMERS ============

export async function addCustomer({ name, phone, address, notes, birthday }) {
  if (!name?.trim()) throw new Error("Customer name is required");
  const now = Date.now();
  const record = {
    shopId: getCurrentShopId(),
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
  };
  const id = await db.transaction("rw", [db.customers, db.syncQueue], async () => {
    const createdId = await db.customers.add(record);
    if (isSyncConfigured()) {
      await queueOperation("customers", createdId, "upsert", { ...record, id: createdId });
    }
    return createdId;
  });
  if (isSyncConfigured() && navigator.onLine) {
    processQueue().catch((error) => console.error("Customer cloud sync remains queued", error));
  }
  return id;
}

export async function updateCustomer(id, data) {
  const result = await db.transaction("rw", [db.customers, db.syncQueue], async () => {
    const existing = await db.customers.get(id);
    if (!existing || existing.shopId !== getCurrentShopId()) {
      throw new Error("Customer does not belong to the selected bakery");
    }
    const { shopId: ignoredShop, id: ignoredId, ...safeData } = data || {};
    const updated = { ...existing, ...safeData, updatedAt: Date.now() };
    await db.customers.put(updated);
    if (isSyncConfigured()) await queueOperation("customers", id, "upsert", updated);
    return id;
  });
  if (isSyncConfigured() && navigator.onLine) {
    processQueue().catch((error) => console.error("Customer cloud sync remains queued", error));
  }
  return result;
}

export async function deleteCustomer(id) {
  await db.transaction("rw", [db.customers, db.syncQueue], async () => {
    const existing = await db.customers.get(id);
    if (!existing || existing.shopId !== getCurrentShopId()) {
      throw new Error("Customer does not belong to the selected bakery");
    }
    if (isSyncConfigured()) await queueOperation("customers", id, "delete");
    await db.customers.delete(id);
  });
  if (isSyncConfigured() && navigator.onLine) {
    processQueue().catch((error) => console.error("Customer deletion remains queued", error));
  }
}

export async function getAllCustomers() {
  const list = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  return list.sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
}

export async function findCustomerByPhone(phone) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  const all = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  return all.find((c) => c.phone.replace(/\D/g, "").endsWith(clean)) || null;
}

export async function searchCustomers(query) {
  const all = await db.customers.where("shopId").equals(getCurrentShopId()).toArray();
  if (!query) return all;
  const q = query.toLowerCase().trim();
  return all.filter((c) =>
    c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
  );
}

// ============ CUSTOMER STATS ============

export async function getCustomerStats(customerId) {
  const customer = await db.customers.get(customerId);
  if (!customer || customer.shopId !== getCurrentShopId()) throw new Error("Customer belongs to another bakery");
  const sales = await db.sales.where("shopId").equals(getCurrentShopId()).toArray();
  const customerSales = sales.filter((s) => s.customerId === customerId);
  const orders = await db.orders.where("shopId").equals(getCurrentShopId()).toArray();
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
  const customer = await db.customers.get(customerId);
  if (!customer || customer.shopId !== getCurrentShopId()) throw new Error("Customer belongs to another bakery");
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
  // The order, every child item, the advance payment, and every durable sync
  // intent must commit together. No visible order can have a missing payment
  // queue record after a crash or an offline network transition.
  const advance = validateNewOrder({ items, totalAmount, advanceAmount });
  const shopId = getCurrentShopId();
  const now = Date.now();
  const shouldSync = isSyncConfigured();
  const requestedDelivery = deliveryDate ? new Date(deliveryDate).getTime() : now;
  if (!Number.isFinite(requestedDelivery)) throw new Error("Invalid delivery date");

  let orderId;
  let orderNo;
  await db.transaction("rw",
    [db.settings, db.orders, db.orderItems, db.payments, db.auditLog,
      db.customers, db.products, db.syncQueue],
    async () => {
      if (customerId != null && customerId !== "") {
        const customer = await db.customers.get(customerId);
        if (!customer || customer.shopId !== shopId) {
          throw new Error("Order customer does not belong to the selected bakery");
        }
      }
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product || product.shopId !== shopId) {
          throw new Error("Order product does not belong to the selected bakery");
        }
      }

      const sequence = await db.settings.get("orderSeq");
      const next = (sequence?.value || 0) + 1;
      await db.settings.put({ key: "orderSeq", value: next });
      orderNo = `ORD-${getDeviceTag()}-${String(next).padStart(4, "0")}`;

      const savedItems = items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        qty: it.qty,
        unit: it.unit,
        price: it.price,
        lineTotal: it.qty * it.price,
      }));
      const order = {
        orderNo,
        shopId,
        customerId: customerId || null,
        customerName: customerName || "Walk-in",
        customerPhone: customerPhone || "",
        items: savedItems,
        totalAmount,
        advanceAmount: advance,
        balanceAmount: totalAmount - advance,
        deliveryDate: requestedDelivery,
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
      };
      orderId = await db.orders.add(order);
      if (shouldSync) await queueOperation("orders", orderId, "upsert", { ...order, id: orderId });

      for (const item of savedItems) {
        const itemId = await db.orderItems.add({ orderId, ...item });
        if (shouldSync) {
          await queueOperation("orderItems", itemId, "upsert",
            { id: itemId, orderId, ...item });
        }
      }

      if (advance > 0) {
        const payment = {
          shopId,
          orderId,
          ts: now,
          type: "advance",
          amount: advance,
          note: "Advance at booking",
        };
        const paymentId = await db.payments.add(payment);
        if (shouldSync) {
          await queueOperation("payments", paymentId, "upsert",
            { ...payment, id: paymentId });
        }
      }

      const audit = {
        shopId,
        ts: now,
        userName: user || "system",
        action: "ORDER_CREATED",
        entity: "order",
        entityId: orderId,
        details: { orderNo, totalAmount, advanceAmount: advance },
      };
      const auditId = await db.auditLog.add(audit);
      if (shouldSync) {
        await queueOperation("auditLog", auditId, "upsert", { ...audit, id: auditId });
      }
    }
  );

  // Transmission starts only after the entire local transaction commits.
  if (shouldSync && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) =>
      console.error("Order sync remains queued", error));
  }
  return { orderId, orderNo };
}

export async function updateOrder(orderId, data) {
  const existing = await db.orders.get(orderId);
  if (!existing || existing.shopId !== getCurrentShopId()) throw new Error("Order does not belong to the selected bakery");
  const { shopId: _ignored, id: _ignoredId, ...safeData } = data;
  const updated = await db.orders.update(orderId, { ...safeData, updatedAt: Date.now() });
  pushRecord("orders", await db.orders.get(orderId)).catch(() => {});
  return updated;
}

export async function updateOrderStatus(orderId, status, user) {
  if (!["pending", "ready", "cancelled"].includes(status)) {
    throw new Error("Use order delivery for completing orders");
  }
  const shopId = getCurrentShopId();
  const now = Date.now();
  const shouldSync = isSyncConfigured();
  await db.transaction("rw", [db.orders, db.auditLog, db.syncQueue], async () => {
    const order = await db.orders.get(orderId);
    if (!order || order.shopId !== shopId) {
      throw new Error("Order does not belong to the selected bakery");
    }
    if (order.status === "delivered" || order.status === "cancelled") {
      throw new Error("Cannot change the status of a completed or cancelled order");
    }
    if (status === "cancelled" && (order.advanceAmount || 0) > 0) {
      throw new Error("Refund or settle the recorded advance before cancelling the order");
    }
    const updated = { ...order, status, updatedAt: now };
    await db.orders.put(updated);
    if (shouldSync) await queueOperation("orders", orderId, "upsert", updated);
    const audit = {
      shopId,
      ts: now,
      userName: user || "system",
      action: "ORDER_STATUS_CHANGED",
      entity: "order",
      entityId: orderId,
      details: { status },
    };
    const auditId = await db.auditLog.add(audit);
    if (shouldSync) await queueOperation("auditLog", auditId, "upsert", { id: auditId, ...audit });
  });
  if (shouldSync && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) => console.error("Order status sync remains queued", error));
  }
}

export async function recordOrderPayment(orderId, amount, type = "balance", user) {
  const order = await db.orders.get(orderId);
  if (!order) return;
  if (order.shopId !== getCurrentShopId()) throw new Error("Order does not belong to the selected bakery");

  const now = Date.now();
  const shopId = getCurrentShopId();
  const newPaid = (order.advanceAmount || 0) + amount;

  await db.orders.update(orderId, {
    advanceAmount: newPaid,
    balanceAmount: Math.max(0, order.totalAmount - newPaid),
    updatedAt: now,
  });

  const paymentId = await db.payments.add({
    shopId,
    orderId,
    ts: now,
    type,
    amount,
    note: type === "balance" ? "Balance payment" : "Additional payment",
  });
  await queueSavedChanges([{ table: "orders", id: orderId }, { table: "payments", id: paymentId }]);
}

export async function deleteOrder(orderId) {
  await db.orders.delete(orderId);
  const payments = await db.payments.where("orderId").equals(orderId).toArray();
  for (const p of payments) {
    await db.payments.delete(p.id);
  }
}

export async function getAllOrders({ status, from, to, shopId = getCurrentShopId() } = {}) {
  let all = await db.orders.where("shopId").equals(shopId).toArray();
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

export async function getOrderStats(shopId = getCurrentShopId()) {
  const all = await db.orders.where("shopId").equals(shopId).toArray();
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
  const shopId = getCurrentShopId();
  const counterShop = String(counter).toLowerCase();
  if (counterShop !== shopId) {
    throw new Error("Cannot deliver an order for a different bakery");
  }

  // A delivered order must be atomic: bill, items, stock, movements, payment,
  // customer totals, order status, audit and all cloud queue intents.
  let result;
  const shouldSync = isSyncConfigured();
  await db.transaction("rw", [
    db.settings, db.orders, db.products, db.shopStock,
    db.sales, db.saleItems, db.stockMovements, db.payments,
    db.customers, db.auditLog, db.syncQueue,
  ], async () => {
    const order = await db.orders.get(orderId);
    if (!order || order.shopId !== shopId) {
      throw new Error("Order does not belong to the selected bakery");
    }
    const { balance, change, paidPreviously } =
      validateDeliverySettlement(order, paymentAmount, paymentMode);

    // Verify all items' owners and stock before writing any part of the sale.
    // Each unique product is checked once, even if the order has multiple lines.
    const stockByProduct = new Map();
    for (const item of order.items) {
      const product = await db.products.get(item.productId);
      if (!product || product.shopId !== shopId) {
        throw new Error("Order contains a product from another bakery");
      }
      if (!stockByProduct.has(item.productId)) {
        const row = await db.shopStock
          .where("[shopId+productId]").equals([shopId, item.productId])
          .first();
        stockByProduct.set(item.productId, row);
      }
    }
    const remainingStock = validateDeliveryStock(order.items, stockByProduct);

    const now = Date.now();
    // Reuse the checkout's shop/device-aware bill sequence.
    const billNo = await nextBillNumber(shopId);
    const totalPaid = paidPreviously + balance;
    const payment = {
      mode: paymentMode,
      // Record only money taken at delivery, not advances already recorded
      // separately in the payments table.
      cash: paymentMode === "Cash" ? paymentAmount : 0,
      upi: paymentMode === "UPI" ? balance : 0,
      card: paymentMode === "Card" ? balance : 0,
      paid: totalPaid,
      advance: paidPreviously,
      change,
    };
    const saleRecord = {
      shopId,
      billNo,
      counter: shopId,
      cashier: user || "system",
      ts: now,
      subtotal: order.totalAmount,
      discount: 0,
      total: order.totalAmount,
      payment,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fromOrderId: orderId,
      channel: order.channel || "pos",
      source: order.source || "pos",
      note: `From order ${order.orderNo}`,
      updatedAt: now,
    };
    const saleId = await db.sales.add(saleRecord);
    if (shouldSync) await queueOperation("sales", saleId, "upsert", { id: saleId, ...saleRecord });

    for (const item of order.items) {
      const saleItem = {
        saleId,
        productId: item.productId,
        name: item.productName,
        qty: item.qty,
        unit: item.unit,
        price: item.price,
        lineTotal: item.lineTotal,
      };
      const saleItemId = await db.saleItems.add(saleItem);
      if (shouldSync) {
        await queueOperation("saleItems", saleItemId, "upsert",
          { id: saleItemId, ...saleItem });
      }
    }

    // Persist one final shop-specific balance and movement per product.
    for (const [productId, newStock] of remainingStock) {
      const previous = stockByProduct.get(productId);
      await db.shopStock.update(previous.id, { stock: newStock, updatedAt: now });
      if (shouldSync) {
        await queueOperation("shopStock", previous.id, "upsert",
          await db.shopStock.get(previous.id));
      }
      const product = await db.products.get(productId);
      const deliveredQty = order.items
        .filter((i) => i.productId === productId)
        .reduce((sum, i) => sum + i.qty, 0);
      const movement = {
        shopId,
        ts: now,
        productId,
        productName: product.name,
        qty: -deliveredQty,
        unit: product.unit,
        reason: "sale",
        note: `Order ${order.orderNo} delivered`,
        cost: product.cost || 0,
        userName: user || "system",
        balanceAfter: newStock,
      };
      const movementId = await db.stockMovements.add(movement);
      if (shouldSync) {
        await queueOperation("stockMovements", movementId, "upsert",
          { id: movementId, ...movement });
      }
    }

    if (balance > 0) {
      const paymentRecord = {
        shopId,
        orderId,
        ts: now,
        type: "balance",
        // The tender may exceed the amount due; only the actual debt is earned.
        amount: balance,
        note: `Paid at delivery · ${paymentMode}`,
      };
      const paymentId = await db.payments.add(paymentRecord);
      if (shouldSync) {
        await queueOperation("payments", paymentId, "upsert",
          { id: paymentId, ...paymentRecord });
      }
    }

    const updatedOrder = {
      ...order,
      status: "delivered",
      deliveredAt: now,
      deliveredBy: user || "system",
      billNo,
      saleId,
      balanceAmount: 0,
      updatedAt: now,
    };
    await db.orders.put(updatedOrder);
    if (shouldSync) {
      await queueOperation("orders", orderId, "upsert", updatedOrder);
    }

    if (order.customerId != null) {
      const customer = await db.customers.get(order.customerId);
      if (!customer || customer.shopId !== shopId) {
        throw new Error("Linked order customer is missing or belongs to another bakery");
      }
      const updatedCustomer = {
        ...customer,
        totalSpent: (customer.totalSpent || 0) + order.totalAmount,
        totalOrders: (customer.totalOrders || 0) + 1,
        lastVisit: now,
        updatedAt: now,
      };
      await db.customers.put(updatedCustomer);
      if (shouldSync) {
        await queueOperation("customers", customer.id, "upsert", updatedCustomer);
      }
    }

    const audit = {
      shopId,
      ts: now,
      userName: user || "system",
      action: "ORDER_COMPLETED",
      entity: "order",
      entityId: orderId,
      details: { orderNo: order.orderNo, billNo, totalPaid, paymentMode },
    };
    const auditId = await db.auditLog.add(audit);
    if (shouldSync) {
      await queueOperation("auditLog", auditId, "upsert",
        { id: auditId, ...audit });
    }
    result = { billNo, saleId, change };
  });

  // Only attempt cloud I/O AFTER the entire order delivery commits.
  if (shouldSync && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) =>
      console.error("Order delivery sync remains queued", error));
  }
  return result;
}
