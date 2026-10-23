// ============================================================
// Payment rules for the checkout screen. Pure functions, no database.
//
//  Cash   : customer may hand over MORE than the bill, change is given back.
//  UPI    : must equal the bill exactly (you cannot give change on a digital payment).
//  Card   : must equal the bill exactly.
//  Split  : cash + UPI + card must cover the bill. UPI + card together cannot exceed the bill;
//           any extra comes from cash, and the change is returned from that cash.
//
// The saved payment always reconciles:  (cash - change) + upi + card = bill total.
// ============================================================

import { toCents } from "./money.js";

const fromCents = (c) => c / 100;

export function evaluatePayment({ mode, cash, upi, card, total }) {
  const totalC = toCents(total);
  let cashC = Math.max(0, toCents(cash));
  let upiC = Math.max(0, toCents(upi));
  let cardC = Math.max(0, toCents(card));

  if (mode === "Cash") { upiC = 0; cardC = 0; }
  else if (mode === "UPI") { cashC = 0; cardC = 0; }
  else if (mode === "Card") { cashC = 0; upiC = 0; }

  const paidC = cashC + upiC + cardC;
  const digitalC = upiC + cardC;
  const changeC = Math.max(0, paidC - totalC);
  const remainingC = Math.max(0, totalC - paidC);

  let error = "";
  if (totalC <= 0) error = "The bill total must be more than zero";
  else if (paidC < totalC) error = "";            // still collecting: not an error, just not complete
  else if (mode === "UPI" || mode === "Card") {
    if (paidC !== totalC) error = `${mode} amount must match the bill exactly`;
  } else if (mode === "Split") {
    if (digitalC > totalC) error = "UPI + Card cannot be more than the bill (no change on digital payments)";
  }

  const ok = totalC > 0 && paidC >= totalC && error === "";

  return {
    ok,
    error,
    paid: fromCents(paidC),
    change: fromCents(changeC),
    remaining: fromCents(remainingC),
    payment: {
      mode,
      cash: fromCents(cashC),
      upi: fromCents(upiC),
      card: fromCents(cardC),
      paid: fromCents(paidC),
      change: fromCents(changeC),
    },
  };
}
