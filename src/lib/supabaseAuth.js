// ============================================================
// ROZY POS — Supabase sign-in for the sync account
//
// Without this, the public "anon" key is the only thing protecting your cloud data, and
// anyone who gets the key can read and change everything. With a sync account:
//   1. you create ONE user in Supabase (Authentication -> Users)
//   2. every device signs in with that email + password (Settings -> Cloud Sync)
//   3. you run supabase-security.sql once, which makes the tables readable only by
//      signed-in users, so the anon key alone no longer opens anything.
// If no account is signed in the app behaves exactly as before (anon key only).
// ============================================================

const URL_KEY = "rozy-pos-supabase-url";
const KEY_KEY = "rozy-pos-supabase-key";
const SESSION_KEY = "rozy-pos-sb-session";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function getSyncAccount() {
  const s = readSession();
  return s ? { email: s.email } : null;
}

export function signOutSync() {
  localStorage.removeItem(SESSION_KEY);
}

async function tokenRequest(grant, body) {
  const url = localStorage.getItem(URL_KEY) || "";
  const key = localStorage.getItem(KEY_KEY) || "";
  if (!url || !key) throw new Error("Save the Supabase URL and key first");

  const res = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || `Sign-in failed (${res.status})`);
  }
  return data;
}

function toSession(data, email) {
  return {
    email,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

export async function signInSync(email, password) {
  const data = await tokenRequest("password", { email: email.trim(), password });
  saveSession(toSession(data, email.trim()));
  return { email: email.trim() };
}

let refreshing = null;

// Returns a valid access token, refreshing it shortly before it expires.
async function freshToken() {
  const s = readSession();
  if (!s) return null;
  if (s.expires_at - Date.now() > 60000) return s.access_token;

  if (!refreshing) {
    refreshing = tokenRequest("refresh_token", { refresh_token: s.refresh_token })
      .then((d) => {
        const next = toSession(d, s.email);
        saveSession(next);
        return next.access_token;
      })
      .catch((e) => {
        // offline: keep the old token, it will be refreshed when the network is back
        if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(e.message)) {
          return s.access_token;
        }
        signOutSync(); // refresh token rejected: needs a new sign-in
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Headers for every Supabase request: the signed-in user's token, or the anon key. */
export async function authHeaders() {
  const key = localStorage.getItem(KEY_KEY) || "";
  const token = await freshToken();
  return { apikey: key, Authorization: `Bearer ${token || key}` };
}
