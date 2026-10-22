// Local-date helpers.
// IMPORTANT: never use new Date().toISOString().slice(0, 10) for "today".
// toISOString() is UTC, so in India (UTC+5:30) it returns YESTERDAY between
// 00:00 and 05:30 local time, which put sales and the cash drawer on the wrong day.

const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the device's local timezone. */
export function localDateKey(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
