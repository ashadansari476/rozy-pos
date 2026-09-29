export async function hashPass(p) {
  const buf = new TextEncoder().encode(p + "::bakerySalt");
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}