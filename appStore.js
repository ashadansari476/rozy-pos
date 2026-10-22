import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db } from "../lib/db";
import {
  verifySecret, verifyOwnerPin, isWeakPin,
  lockSecondsLeft, recordFailedLogin, clearFailedLogins,
} from "../lib/auth";
import { wasPageRefreshed } from "../lib/session";

const LANG_KEY = "rozy-pos-lang";
const readLang = () => {
  try { return localStorage.getItem(LANG_KEY) || "en"; } catch { return "en"; }
};

export const useApp = create(
  persist(
    (set, get) => ({
      user: null,
      counter: null,
      language: readLang(),

      login: async ({ pin, username, password }) => {
        const wait = lockSecondsLeft();
        if (wait > 0) {
          return { ok: false, error: `Too many wrong attempts. Try again in ${wait}s` };
        }

        // Owner PIN login
        if (pin) {
          if (!(await verifyOwnerPin(pin))) {
            recordFailedLogin();
            return { ok: false, error: "Wrong PIN" };
          }
          clearFailedLogins();
          // A known/obvious PIN is accepted once, but the owner must replace it.
          if (isWeakPin(pin)) return { ok: false, mustChangePin: true };
          set({
            user: { username: "Owner", role: "owner", shopId: null },
            counter: "Both",
          });
          return { ok: true };
        }

        // Cashier login (username + password)
        if (!username || !password) {
          return { ok: false, error: "Enter username and password" };
        }

        const u = await db.users.where("username").equals(username.trim()).first();
        if (!u || !(await verifySecret(password, u.password))) {
          recordFailedLogin();
          return { ok: false, error: "Invalid credentials" };
        }
        clearFailedLogins();

        set({
          user: {
            username: u.username,
            role: u.role,
            shopId: u.shopId || "rozy",
          },
          counter: u.shopId || "rozy",
        });
        return { ok: true };
      },

      logout: () => {
        set({ user: null, counter: null });
        // don't leave one person's open bill on screen for the next login
        import("./cartStore").then(({ useCart }) => useCart.getState().clear()).catch(() => {});
      },

      setCounter: (counter) => {
        const u = get().user;
        // Cashiers are locked to their assigned shop
        if (u && u.role === "cashier") return;
        set({ counter });
      },

      setLanguage: (language) => {
        try { localStorage.setItem(LANG_KEY, language); } catch { /* ignore */ }
        set({ language });
      },
    }),
    {
      name: "rozy-pos-app",
      // Session lives in sessionStorage: closing the tab or browser logs out,
      // so a shared shop computer never stays logged in as Owner.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ user: s.user, counter: s.counter }),
      onRehydrateStorage: () => (state) => {
        // Skip in dev mode so hot-reload doesn't log you out
        if (import.meta.env.DEV) return;
        // Page refresh logs out in production
        if (state && wasPageRefreshed() && state.user) {
          state.user = null;
          state.counter = null;
        }
      },
    }
  )
);
