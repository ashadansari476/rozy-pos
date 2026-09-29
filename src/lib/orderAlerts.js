import { db } from "./db";
import { showToast } from "../components/ui/Toast";

const LAST_ALERT_KEY = "rozy-pos-order-alert-last";
const ALERT_INTERVAL_MS = 4 * 60 * 60 * 1000;

export async function getOrdersDueSoon() {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  const all = await db.orders.toArray();
  return all
    .filter(
      (o) =>
        (o.status === "pending" || o.status === "ready") &&
        o.deliveryDate >= now - 24 * 60 * 60 * 1000 &&
        o.deliveryDate <= in24h
    )
    .sort((a, b) => a.deliveryDate - b.deliveryDate);
}

export async function getOverdueOrders() {
  const now = Date.now();
  const all = await db.orders.toArray();
  return all
    .filter(
      (o) => (o.status === "pending" || o.status === "ready") && o.deliveryDate < now
    )
    .sort((a, b) => a.deliveryDate - b.deliveryDate);
}

export function formatTimeUntil(deliveryTs) {
  const diff = deliveryTs - Date.now();
  if (diff < 0) {
    const overdue = Math.abs(diff);
    const hours = Math.floor(overdue / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h overdue`;
    return `${Math.floor(hours / 24)}d overdue`;
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "due soon";
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export async function checkOrderAlerts(force = false) {
  const last = parseInt(localStorage.getItem(LAST_ALERT_KEY) || "0");
  const now = Date.now();

  if (!force && now - last < ALERT_INTERVAL_MS) {
    return { shown: false, reason: "interval" };
  }

  const [dueSoon, overdue] = await Promise.all([
    getOrdersDueSoon(),
    getOverdueOrders(),
  ]);

  if (dueSoon.length === 0 && overdue.length === 0) {
    return { shown: false, reason: "no-orders" };
  }

  if (overdue.length > 0) {
    const lines = overdue.slice(0, 3).map((o) => {
      return `• ${o.orderNo} — ${o.customerName} (${formatTimeUntil(o.deliveryDate)})`;
    });
    const extra = overdue.length > 3 ? `\n+ ${overdue.length - 3} more` : "";
    showToast(
      `🚨 ${overdue.length} OVERDUE order${overdue.length > 1 ? "s" : ""}\n${lines.join("\n")}${extra}`,
      "error",
      8000
    );
  }

  if (dueSoon.length > 0) {
    setTimeout(() => {
      const lines = dueSoon.slice(0, 3).map((o) => {
        return `• ${o.orderNo} — ${o.customerName} (${formatTimeUntil(o.deliveryDate)})`;
      });
      const extra = dueSoon.length > 3 ? `\n+ ${dueSoon.length - 3} more` : "";
      showToast(
        `⏰ ${dueSoon.length} order${dueSoon.length > 1 ? "s" : ""} due soon\n${lines.join("\n")}${extra}`,
        "warning",
        8000
      );
    }, overdue.length > 0 ? 1200 : 0);
  }

  localStorage.setItem(LAST_ALERT_KEY, String(now));
  return { shown: true, dueSoon: dueSoon.length, overdue: overdue.length };
}

export function scheduleOrderAlerts() {
  setTimeout(() => checkOrderAlerts(), 3000);
  setInterval(() => checkOrderAlerts(true), ALERT_INTERVAL_MS);
}