// ============================================================
// ROZY POS — Authentication helpers
// - PBKDF2 hashing with a random salt per secret (the old code used one fixed salt)
// - Owner PIN lives in the local database as a hash, never as plain text
// - Failed-attempt lockout so a 4-digit PIN cannot be guessed by tapping
// NOTE: this is device-level protection for a browser app. Real server-side
// security needs Supabase Auth + row-level security (see README).
// ============================================================

import { db } from "./db";

const ITERATIONS = 150000;
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

function subtle() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure context required. Open the app over https:// (or localhost).");
  }
  return globalThis.crypto.subtle;
}

async function pbkdf2(secret, salt, iterations) {
  const key = await subtle().importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return toHex(bits);
}

// constant-time-ish string compare
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns "pbkdf2$iterations$saltHex$hashHex". */
export async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await pbkdf2(secret, salt, ITERATIONS)}`;
}

// Old format used by earlier versions: SHA-256(secret + fixed salt)
async function legacyHash(secret) {
  const h = await subtle().digest("SHA-256", enc.encode(secret + "::bakerySalt"));
  return toHex(h);
}

/** Verifies new hashes, old hashes, and (for very old data) plain text. */
export async function verifySecret(secret, stored) {
  if (typeof secret !== "string" || typeof stored !== "string" || !stored) return false;
  if (stored.startsWith("pbkdf2$")) {
    const [, iter, salt, hash] = stored.split("$");
    return safeEqual(await pbkdf2(secret, fromHex(salt), parseInt(iter, 10)), hash);
  }
  if (safeEqual(await legacyHash(secret), stored)) return true;
  return safeEqual(secret, stored);
}

// ---------- Owner PIN ----------
// The old source code shipped with a default owner PIN that is visible in the public
// repository. It is treated as "not set" and the owner is forced to choose a new one.
const KNOWN_DEFAULT_PIN = "9832";
const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "0123", "1212", "2580", "000000", "111111", "123456", "654321",
  KNOWN_DEFAULT_PIN,
]);

export function isWeakPin(pin) {
  return !/^\d{4,6}$/.test(pin) || WEAK_PINS.has(pin);
}

export async function hasOwnerPin() {
  const rec = await db.settings.get("ownerPin");
  return !!rec?.value;
}

export async function verifyOwnerPin(pin) {
  const rec = await db.settings.get("ownerPin");
  return !!rec?.value && (await verifySecret(pin, rec.value));
}

export async function setOwnerPin(pin) {
  if (isWeakPin(pin)) {
    throw new Error("Choose a 4-6 digit PIN that is not obvious (no 1234, 0000, repeated digits).");
  }
  await db.settings.put({ key: "ownerPin", value: await hashSecret(pin) });
}

// ---------- Lockout after repeated failures ----------
const LOCK_KEY = "rozy-pos-lock";

function readLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}");
  } catch {
    return {};
  }
}

export function lockSecondsLeft() {
  const { until = 0 } = readLock();
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function recordFailedLogin() {
  const { fails = 0 } = readLock();
  const n = fails + 1;
  // 5 misses -> 30 s, then 60 s, 120 s ... capped at 5 minutes
  const until = n >= 5 ? Date.now() + Math.min(300, 30 * 2 ** (n - 5)) * 1000 : 0;
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ fails: n, until }));
  } catch { /* storage full or blocked */ }
}

export function clearFailedLogins() {
  try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
}
