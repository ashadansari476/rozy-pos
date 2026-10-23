import { db, getDeviceTag } from "./db";
import { pushRecord, queueOperation, isSyncConfigured } from "./syncEngine";

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
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("An order must contain at least one item");
  }
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error("Order total must be a valid non-negative amount");
  }
  const advance = advanceAmount ?? 0;
  if (!Number.isFinite(advance) || advance < 0 || advance > totalAmount) {
    throw new Error("Advance payment must be between zero and the order total");
  }
  for (const item of items) {
    if (!item || item.productId == null || !Number.isFinite(item.qty) || item.qty <= 0 ||
        !Number.isFinite(item.price) || item.price < 0) {
      throw new Error("Every order item needs a product, positive quantity, and valid price");
    }
  }

  const now = Date.now();
  const shopId = getCurrentShopId();
  let orderId;
  let orderNo;
  let paymentId = null;
  let orderRecord;
  let paymentRecord = null;

  // Order, advance payment, audit event and sequence are one local transaction.
  // A failed write must not leave an order without its payment/audit record.
  await db.transaction("rw", [db.settings, db.orders, db.payments, db.auditLog], async () => {
    const orderSeqRec = await db.settings.get("orderSeq");
    const orderSeq = (orderSeqRec?.value || 0) + 1;
    await db.settings.put({ key: "orderSeq", value: orderSeq });
    orderNo = `ORD-${getDeviceTag()}-${String(orderSeq).padStart(4, "0")}`;

    const normalizedItems = items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      lineTotal: it.qty * it.price,
    }));

    orderRecord = {
      orderNo,
      shopId,
      customerId: customerId || null,
      customerName: customerName || "Walk-in",
      customerPhone: customerPhone || "",
      items: normalizedItems,
      totalAmount,
      advanceAmount: advance,
      balanceAmount: totalAmount - advance,
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
    };
    orderId = await db.orders.add(orderRecord);
    orderRecord = { ...orderRecord, id: orderId };

    if (advance > 0) {
      paymentRecord = {
        shopId,
        orderId,
        ts: now,
        type: "advance",
        amount: advance,
        userName: user || "system",
        note: "Advance at booking",
      };
      paymentId = await db.payments.add(paymentRecord);
      paymentRecord = { ...paymentRecord, id: paymentId };
    }

    await db.auditLog.add({
      shopId,
      ts: now,
      userName: user || "system",
      action: "ORDER_CREATED",
      entity: "order",
      entityId: orderId,
      details: { orderNo, totalAmount, advanceAmount: advance },
    });
  });

  // Queue cloud writes only after the local transaction commits.
  pushRecord("orders", orderRecord).catch(() => {});
  if (paymentRecord) pushRecord("payments", paymentRecord).catch(() => {});

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
  const order = await db.orders.get(orderId);
  if (!order) return;
  const shopId = getCurrentShopId();
  if (order.shopId && order.shopId !== shopId) {
    throw new Error("Cannot delete an order belonging to another shop");
  }

  const payments = await db.payments.where("orderId").equals(orderId).toArray();
  if (payments.length > 0 || Number(order.advanceAmount) > 0) {
    throw new Error("This order has payment history and cannot be deleted. Cancel it and record any required refund instead.");
  }

  await db.transaction("rw", [db.orders, db.auditLog, db.syncQueue], async () => {
    await db.orders.delete(orderId);
    await db.auditLog.add({
      shopId,
      ts: Date.now(),
      userName: "system",
      action: "ORDER_DELETED",
      entity: "order",
      entityId: orderId,
      details: { orderNo: order.orderNo },
    });
    if (isSyncConfigured()) {
      await queueOperation("orders", orderId, "delete", null);
    }
  });

  import("../stores/syncStore").then(({ useSync }) => useSync.getState().sync()).catch(() => {});
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
  const initialOrder = await db.orders.get(orderId);
  if (!initialOrder) throw new Error("Order not found");
  if (initialOrder.status === "delivered") throw new Error("Order already delivered");

  const shopId = getCurrentShopId();
  if (initialOrder.shopId && initialOrder.shopId !== shopId) {
    throw new Error("Cannot complete an order belonging to another shop");
  }

  const receivedAtDelivery = paymentAmount ?? 0;
  if (!Number.isFinite(receivedAtDelivery) || receivedAtDelivery < 0) {
    throw new Error("Delivery payment must be a valid non-negative amount");
  }
  if (!["Cash", "UPI", "Card"].includes(paymentMode)) {
    throw new Error("Unsupported payment mode");
  }

  const now = Date.now();
  let billNo;
  let saleId;
  let change = 0;
  let saleRecord;
  let paymentRecord = null;
  let stockPushes = [];
  let saleItemPushes = [];
  let updatedOrder;

  // Delivery touches the sale, sale items, stock, payment ledger, customer totals,
  // order status, bill sequence, and audit trail. Keep all of those writes atomic.
  await db.transaction(
    "rw",
    [
      db.settings, db.orders, db.sales, db.saleItems, db.shopStock,
      db.stockMovements, db.payments, db.customers, db.products, db.auditLog,
    ],
    async () => {
      const order = await db.orders.get(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status === "delivered") throw new Error("Order already delivered");
      if (order.shopId && order.shopId !== shopId) {
        throw new Error("Cannot complete an order belonging to another shop");
      }
      if (!Array.isArray(order.items) || order.items.length === 0) {
        throw new Error("Order has no items to deliver");
      }

      const advancePaid = Number(order.advanceAmount) || 0;
      const outstanding = Math.max(0, Number(order.totalAmount) - advancePaid);
      if (paymentMode !== "Cash" && receivedAtDelivery > outstanding) {
        throw new Error("Digital payment cannot exceed the outstanding balance");
      }
      const totalPaid = advancePaid + receivedAtDelivery;
      if (totalPaid < Number(order.totalAmount)) {
        throw new Error(`Insufficient payment. Remaining balance: ${(Number(order.totalAmount) - totalPaid).toFixed(2)}`);
      }
      change = paymentMode === "Cash" ? Math.max(0, totalPaid - Number(order.totalAmount)) : 0;

      const shopsRec = await db.settings.get("shops");
      const shop = shopsRec?.value?.find((item) => item.id === shopId);
      const prefix = shop?.billPrefix || (shopId === "rozy" ? "RZ" : shopId.slice(0, 2).toUpperCase());
      const seqKey = `billSeq_${shopId}`;
      const rec = await db.settings.get(seqKey);
      const next = (rec?.value || 0) + 1;
      await db.settings.put({ key: seqKey, value: next });
      billNo = `${prefix}-${getDeviceTag()}-${String(next).padStart(4, "0")}`;

      const requestedByProduct = new Map();
      for (const item of order.items) {
        if (item.productId == null || !Number.isFinite(item.qty) || item.qty <= 0 ||
            !Number.isFinite(item.price) || item.price < 0) {
          throw new Error("Order contains an invalid item");
        }
        requestedByProduct.set(
          item.productId,
          (requestedByProduct.get(item.productId) || 0) + item.qty
        );
      }

      const stockByProduct = new Map();
      const productById = new Map();
      for (const [productId, qty] of requestedByProduct) {
        const stock = await db.shopStock
          .where("[shopId+productId]")
          .equals([shopId, productId])
          .first();
        const product = await db.products.get(productId);
        const available = Number.isFinite(stock?.stock) ? stock.stock : 0;
        if (!stock || qty > available) {
          throw new Error(`Insufficient stock for ${product?.name || "product"}: ${available} available, ${qty} requested.`);
        }
        stockByProduct.set(productId, stock);
        productById.set(productId, product);
      }

      saleRecord = {
        shopId,
        billNo,
        counter: shop?.shortName || counter,
        cashier: user || "system",
        ts: now,
        subtotal: order.totalAmount,
        discount: 0,
        tax: 0,
        total: order.totalAmount,
        payment: {
          mode: paymentMode,
          // The order's advance was already recorded as order cash-in; only count
          // the amount received at delivery here to avoid double-counting the advance.
          cash: paymentMode === "Cash" ? receivedAtDelivery : 0,
          upi: paymentMode === "UPI" ? receivedAtDelivery : 0,
          card: paymentMode === "Card" ? receivedAtDelivery : 0,
          paid: totalPaid,
          change,
        },
        customerId: order.customerId || null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        fromOrderId: orderId,
        channel: order.channel || "pos",
        source: order.source || "pos",
        note: `From order ${order.orderNo}`,
        createdAt: now,
        updatedAt: now,
      };
      saleId = await db.sales.add(saleRecord);
      saleRecord = { ...saleRecord, id: saleId };

      for (const item of order.items) {
        const product = productById.get(item.productId);
        const stock = stockByProduct.get(item.productId);
        const newStock = stock.stock - item.qty;
        await db.shopStock.update(stock.id, { stock: newStock, updatedAt: now });
        // Keep the in-memory balance in step with the transaction so repeated lines
        // for the same product deduct cumulatively rather than from the original balance.
        stockByProduct.set(item.productId, { ...stock, stock: newStock, updatedAt: now });
        stockPushes.push({
          id: stock.id,
          shopId,
          productId: item.productId,
          stock: newStock,
          lowStock: stock.lowStock ?? 5,
          updatedAt: now,
        });

        const saleItem = {
          saleId,
          productId: item.productId,
          name: item.productName || product?.name || "Product",
          qty: item.qty,
          unit: item.unit || product?.unit || "piece",
          price: item.price,
          cost: Number.isFinite(item.cost) ? item.cost : (product?.cost || 0),
          lineTotal: item.lineTotal ?? item.qty * item.price,
        };
        const saleItemId = await db.saleItems.add(saleItem);
        saleItemPushes.push({ ...saleItem, id: saleItemId });

        await db.stockMovements.add({
          shopId,
          ts: now,
          productId: item.productId,
          productName: saleItem.name,
          qty: -item.qty,
          unit: saleItem.unit,
          reason: "sale",
          note: `Order ${order.orderNo} delivered`,
          cost: saleItem.cost,
          userName: user || "system",
          balanceAfter: newStock,
        });
      }

      if (receivedAtDelivery > 0) {
        paymentRecord = {
          shopId,
          orderId,
          ts: now,
          type: "balance",
          amount: receivedAtDelivery,
          userName: user || "system",
          note: `Paid at delivery · ${paymentMode}`,
        };
        const paymentId = await db.payments.add(paymentRecord);
        paymentRecord = { ...paymentRecord, id: paymentId };
      }

      updatedOrder = {
        ...order,
        shopId,
        status: "delivered",
        deliveredAt: now,
        deliveredBy: user || "system",
        billNo,
        saleId,
        balanceAmount: 0,
        updatedAt: now,
      };
      await db.orders.put(updatedOrder);

      if (order.customerId) {
        const customer = await db.customers.get(order.customerId);
        if (customer && (!customer.shopId || customer.shopId === shopId)) {
          await db.customers.update(order.customerId, {
            totalSpent: (customer.totalSpent || 0) + order.totalAmount,
            totalOrders: (customer.totalOrders || 0) + 1,
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
    }
  );

  // Queue sync only after all local business records have committed.
  pushRecord("sales", saleRecord).catch(() => {});
  for (const item of saleItemPushes) pushRecord("saleItems", item).catch(() => {});
  // Only push the final balance once per stock row; multiple lines for the same product
  // must not race each other and leave an intermediate balance in the cloud.
  for (const stock of new Map(stockPushes.map((item) => [item.id, item])).values()) {
    pushRecord("shopStock", stock).catch(() => {});
  }
  pushRecord("orders", updatedOrder).catch(() => {});
  if (paymentRecord) pushRecord("payments", paymentRecord).catch(() => {});

  import("../stores/syncStore").then(({ useSync }) => {
    useSync.getState().sync();
  }).catch(() => {});

  return { billNo, saleId, change };
}

