import { hashSecret } from "./auth";

// Kept under the old name so existing imports (shops.js) keep working.
// New passwords are stored as salted PBKDF2 hashes.
export async function hashPass(p) {
  return hashSecret(p);
}
