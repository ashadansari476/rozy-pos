// Generate order slip HTML for printing

export function buildOrderHTML(order, size = "58") {
  const date = new Date(order.deliveryDate);
  const dateStr = date.toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  const created = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const widthClass = size === "58" ? "receipt-58" : size === "80" ? "receipt-80" : "receipt-a4";

  const itemsHTML = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:2px 0">${it.productName}</td>
        <td style="text-align:right;padding:2px 0">${it.qty}${it.unit === "kg" ? "kg" : "×"}</td>
        <td style="text-align:right;padding:2px 0">₹${(it.lineTotal || it.qty * it.price).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="${widthClass}" style="padding:10px;background:#fff;color:#000">
      <div style="text-align:center;font-weight:bold;font-size:14px">
        ${size === "a4" ? "ORDER SLIP" : "ORDER"}
      </div>
      <div style="text-align:center;font-size:10px;margin-top:2px">
        ${order.orderNo}
      </div>
      <div style="border-top:1px dashed #000;margin:8px 0"></div>

      <div><b>Customer:</b> ${order.customerName || "—"}</div>
      ${order.customerPhone ? `<div><b>Phone:</b> ${order.customerPhone}</div>` : ""}
      <div><b>Delivery:</b> ${dateStr}</div>
      <div><b>Time:</b> ${timeStr}</div>
      <div><b>Type:</b> ${order.orderType === "delivery" ? "Home Delivery" : "Pickup"}</div>
      ${order.address ? `<div><b>Address:</b> ${order.address}</div>` : ""}

      <div style="border-top:1px dashed #000;margin:8px 0"></div>
      <table style="width:100%;font-size:11px">
        <thead>
          <tr style="border-bottom:1px solid #000">
            <th style="text-align:left;padding-bottom:4px">Item</th>
            <th style="text-align:right;padding-bottom:4px">Qty</th>
            <th style="text-align:right;padding-bottom:4px">Amt</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <div style="border-top:1px dashed #000;margin:8px 0"></div>

      <div style="display:flex;justify-content:space-between">
        <span>Total</span>
        <span style="font-weight:bold">₹${order.totalAmount.toFixed(2)}</span>
      </div>
      ${order.advanceAmount > 0 ? `
        <div style="display:flex;justify-content:space-between">
          <span>Advance</span>
          <span style="color:#080">₹${order.advanceAmount.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:bold">
          <span>Balance</span>
          <span style="color:#a30">₹${order.balanceAmount.toFixed(2)}</span>
        </div>
      ` : ""}

      ${order.notes ? `
        <div style="border-top:1px dashed #000;margin:8px 0"></div>
        <div style="font-size:11px"><b>Notes:</b></div>
        <div style="font-size:11px">${order.notes}</div>
      ` : ""}

      <div style="border-top:1px dashed #000;margin:8px 0"></div>
      <div style="text-align:center;font-size:9px">
        Created ${created}<br>
        Rozy POS
      </div>
    </div>`;
}

// Print handler
export function printOrder(order, size = "58") {
  const html = buildOrderHTML(order, size);
  const w = window.open("", "_blank", "width=500,height=700");
  w.document.write(`
    <html>
    <head>
      <title>Order ${order.orderNo}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; }
        .receipt-58 { width: 200px; margin: 0 auto; font-size: 11px; }
        .receipt-80 { width: 280px; margin: 0 auto; font-size: 12px; }
        .receipt-a4 { width: 100%; font-family: Arial, sans-serif; font-size: 13px; padding: 30px; }
        @media print {
          @page { margin: ${size === "a4" ? "15mm" : "0"}; size: ${size === "a4" ? "A4" : size === "80" ? "80mm auto" : "58mm auto"}; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 400);
}