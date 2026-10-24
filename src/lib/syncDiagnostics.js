// Read-only live REST smoke tests. Runs in the signed-in preview browser;
// never send Supabase tokens, passwords, or private keys to support.
import { authHeaders } from "./supabaseAuth";
import { getSupabaseUrl, getSupabaseKey } from "./supabase";

const SHOP_TABLES = [
  "audit_log", "batches", "cash_drawer", "categories", "customers",
  "expenses", "orders", "payments", "pos_users", "products",
  "purchases", "sales", "shop_stock", "stock_movements", "suppliers",
  "targets", "users", "wastage",
];
const CHILD_TABLES = ["order_items", "purchase_items", "sale_items"];

async function readRest(url, headers, path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "GET",
    headers: { ...headers, Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data)) throw new Error("Expected rows array");
    return data;
  } catch {
    throw new Error("Invalid cloud JSON");
  }
}

export async function runReadOnlyCloudDiagnostics() {
  const url = getSupabaseUrl()?.replace(/\/$/, "");
  const key = getSupabaseKey();
  if (!url || !key) throw new Error("Configure the Supabase URL and publishable key first");
  const auth = await authHeaders();
  const checks = [];
  for (const shop of ["rozy", "warish"]) {
    for (const table of SHOP_TABLES) {
      checks.push({
        title: `${table} / ${shop}`,
        path: `${table}?select=id,shop_id&shop_id=eq.${shop}&limit=1`,
        shop,
      });
    }
  }
  for (const table of CHILD_TABLES) {
    checks.push({ title: table, path: `${table}?select=id&limit=1` });
  }

  const errors = [];
  let passed = 0;
  // Avoid overwhelming the live Supabase PostgREST service.
  for (let i = 0; i < checks.length; i += 4) {
    await Promise.all(checks.slice(i, i + 4).map(async (check) => {
      try {
        const rows = await readRest(url, auth, check.path);
        if (check.shop && rows.some((row) => row.shop_id !== check.shop)) {
          throw new Error("Unexpected cross-shop row returned");
        }
        passed++;
      } catch (error) {
        errors.push(`${check.title}: ${error.message}`);
      }
    }));
  }

  try {
    const membership = await readRest(url, auth,
      "pos_shop_memberships?select=shop_id,role&limit=10");
    for (const shop of ["rozy", "warish"]) {
      if (!membership.some((row) => row.shop_id === shop && row.role === "owner")) {
        throw new Error(`Missing owner membership for ${shop}`);
      }
    }
    passed++;
  } catch (error) {
    errors.push(`owner membership: ${error.message}`);
  }

  try {
    const anon = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
      headers: { apikey: key, Accept: "application/json" },
    });
    if (anon.status !== 401 && anon.status !== 403) {
      throw new Error(`Expected HTTP 401/403, received ${anon.status}`);
    }
    passed++;
  } catch (error) {
    errors.push(`anonymous restriction: ${error.message}`);
  }

  return {
    passed,
    total: checks.length + 2,
    errors,
    ok: errors.length === 0 && passed === checks.length + 2,
  };
}
