import { getSupabaseUrl, getSupabaseKey } from "./supabase";
import { authHeaders } from "./supabaseAuth";

const BUCKET = "product-images";

// ---------- Upload ----------
export async function uploadProductImage(productId, blob) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    console.warn("Supabase not configured — storing locally only");
    return null;
  }

  // Unique filename per upload (busts cache)
  const filename = `${productId}-${Date.now()}.jpg`;
  const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${filename}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  // Public URL
  return `${url}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// ---------- Delete old image ----------
export async function deleteProductImage(imageUrl) {
  if (!imageUrl) return;

  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return;

  // Extract filename from URL
  const match = imageUrl.match(/\/product-images\/(.+)$/);
  if (!match) return;

  const filename = match[1];
  const deleteUrl = `${url}/storage/v1/object/${BUCKET}/${filename}`;

  try {
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        ...(await authHeaders()),
      },
    });
  } catch (e) {
    console.warn("Failed to delete old image:", e.message);
  }
}