import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "../lib/db";
import { hashPass } from "../lib/users";
import { wasPageRefreshed } from "../lib/session";

export const useApp = create(
  persist(
    (set, get) => ({
      user: null,
      counter: null,
      language: "en",

      login: async ({ pin, username, password }) => {
        // Owner PIN login
        const ownerPin = await db.settings.get("ownerPin");
        if (pin && ownerPin?.value === pin) {
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

        const u = await db.users.where("username").equals(username).first();
        if (!u) {
          return { ok: false, error: "Invalid credentials" };
        }

        const hashed = await hashPass(password);
        const matches = u.password === hashed || u.password === password;

        if (!matches) {
          return { ok: false, error: "Invalid credentials" };
        }

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

      logout: () => set({ user: null, counter: null }),
      setCounter: (counter) => set({ counter }),
      setLanguage: (language) => set({ language }),
    }),
       {
      name: "rozy-pos-app",
      partialize: (s) => ({
        user: s.user,
        counter: s.counter,
        language: s.language,
      }),
           onRehydrateStorage: () => (state) => {
        // Skip in dev mode (import.meta.env.DEV is true during npm run dev)
        // Will activate automatically in production (after deploy)
        if (import.meta.env.DEV) {
          return;
        }

        // If page was refreshed, log out
        if (state && wasPageRefreshed() && state.user) {
          state.user = null;
          state.counter = null;
        }
      },
    }
  )
);