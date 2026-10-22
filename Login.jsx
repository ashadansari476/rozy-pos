import { useState, useEffect } from "react";
import { useApp } from "../stores/appStore";
import { Delete, LogIn, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "../lib/db";
import { hasOwnerPin, setOwnerPin, isWeakPin, lockSecondsLeft } from "../lib/auth";

const MAX_PIN = 6;

export default function Login() {
  const [mode, setMode] = useState("pin"); // "pin" | "cashier" | "setup"
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupNote, setSetupNote] = useState("");
  const [firstPin, setFirstPin] = useState(null); // set while confirming a new PIN
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shop, setShop] = useState(null);
  const [lockLeft, setLockLeft] = useState(lockSecondsLeft());
  const login = useApp((s) => s.login);

  // shop name + first-run check
  useEffect(() => {
    let alive = true;
    (async () => {
      const rec = await db.settings.get("shop");
      if (alive && rec?.value) setShop(rec.value);
      if (alive && !(await hasOwnerPin())) {
        setNeedsSetup(true);
        setSetupNote("Welcome! Create a PIN for the owner account.");
        setMode("setup");
      }
    })();
    return () => { alive = false; };
  }, []);

  // lockout countdown
  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setInterval(() => setLockLeft(lockSecondsLeft()), 1000);
    return () => clearInterval(t);
  }, [lockLeft]);

  const flash = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 2800);
  };

  const press = (d) => setPin((p) => (p.length < MAX_PIN ? p + d : p));
  const back = () => setPin((p) => p.slice(0, -1));

  const finishSetup = async () => {
    if (isWeakPin(pin)) {
      flash("Too easy to guess. Avoid 1234, 0000 and repeated digits.");
      setPin("");
      return;
    }
    if (firstPin === null) {
      setFirstPin(pin);
      setPin("");
      return;
    }
    if (firstPin !== pin) {
      flash("The two PINs did not match. Start again.");
      setFirstPin(null);
      setPin("");
      return;
    }
    await setOwnerPin(pin);
    setNeedsSetup(false);
    const res = await login({ pin });
    if (!res.ok) flash(res.error || "Could not sign in");
  };

  const submitPin = async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    try {
      if (mode === "setup") {
        await finishSetup();
        return;
      }
      const res = await login({ pin });
      if (res.mustChangePin) {
        setNeedsSetup(true);
        setSetupNote("That PIN is too easy to guess. Choose a new owner PIN.");
        setMode("setup");
        setFirstPin(null);
        setPin("");
        return;
      }
      if (!res.ok) {
        flash(res.error || "Wrong PIN");
        setPin("");
        setLockLeft(lockSecondsLeft());
      }
    } catch (e) {
      flash(e.message || "Something went wrong");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const submitCashier = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await login({ username, password });
      if (!res.ok) {
        setError(res.error);
        setLockLeft(lockSecondsLeft());
      }
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // physical keyboard: digits, Backspace, Enter
  useEffect(() => {
    if (mode === "cashier") return;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") submitPin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pinMode = mode !== "cashier";
  const dots = Math.max(4, pin.length);
  const locked = lockLeft > 0;

  const keyBtn =
    "h-14 sm:h-16 rounded-xl2 bg-bg/45 hover:bg-primary-light text-2xl font-semibold font-mono text-ink transition disabled:opacity-40";

  return (
    <div className="min-h-full overflow-y-auto bg-bg/45 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-5xl mb-2">🧁</div>
          <h1 className="font-serif text-2xl sm:text-3xl text-primary font-semibold">
            {shop?.name || "Rozy POS"}
          </h1>
          {shop?.address && (
            <p className="text-ink-muted text-sm mt-1">{shop.address}</p>
          )}
        </div>

        <div className="card p-5 sm:p-6">
          <div className="flex gap-2 mb-5 bg-bg/45 p-1 rounded-xl">
            <button
              onClick={() => { setMode(needsSetup ? "setup" : "pin"); setError(""); setPin(""); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                pinMode ? "bg-surface/70 shadow-warm text-primary" : "text-ink-muted"
              }`}
            >
              Owner
            </button>
            <button
              onClick={() => { setMode("cashier"); setError(""); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                !pinMode ? "bg-surface/70 shadow-warm text-primary" : "text-ink-muted"
              }`}
            >
              Cashier
            </button>
          </div>

          {locked && (
            <div className="mb-4 rounded-xl bg-danger/10 text-danger text-sm text-center py-2 px-3">
              Too many wrong attempts. Try again in {lockLeft}s.
            </div>
          )}

          {pinMode ? (
            <>
              {mode === "setup" ? (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm mb-1">
                    <ShieldCheck size={16} />
                    {firstPin === null ? "Create owner PIN" : "Confirm owner PIN"}
                  </div>
                  <p className="text-ink-muted text-xs">
                    {firstPin === null
                      ? `${setupNote} Use 4 to 6 digits.`
                      : "Enter the same PIN again."}
                  </p>
                </div>
              ) : (
                <p className="text-center text-ink-muted text-sm mb-4">Enter your PIN</p>
              )}

              <div className="flex justify-center gap-3 mb-5" aria-label="PIN entry">
                {Array.from({ length: dots }).map((_, i) => (
                  <div key={i} className={`pin-dot ${pin.length > i ? "filled" : ""}`} />
                ))}
              </div>

              {error && (
                <div className="text-center text-danger text-sm mb-3 animate-fadeUp" role="alert">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <button key={d} onClick={() => press(String(d))} disabled={locked} className={keyBtn}>
                    {d}
                  </button>
                ))}
                <button
                  onClick={back}
                  aria-label="Delete last digit"
                  className={`${keyBtn} flex items-center justify-center`}
                >
                  <Delete size={24} />
                </button>
                <button onClick={() => press("0")} disabled={locked} className={keyBtn}>
                  0
                </button>
                <button
                  onClick={submitPin}
                  disabled={pin.length < 4 || busy || locked}
                  aria-label={mode === "setup" ? "Continue" : "Log in"}
                  className="h-14 sm:h-16 rounded-xl2 bg-primary text-white hover:bg-primary-hover
                             disabled:opacity-40 flex items-center justify-center transition"
                >
                  <LogIn size={24} />
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); submitCashier(); }}
            >
              <label className="label" htmlFor="login-user">Username</label>
              <input
                id="login-user"
                className="input mb-4"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cashier1"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <label className="label" htmlFor="login-pass">Password</label>
              <input
                id="login-pass"
                className="input mb-5"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
              />
              {error && (
                <div className="text-danger text-sm mb-3 text-center" role="alert">{error}</div>
              )}
              <button type="submit" disabled={busy || locked} className="btn-primary w-full py-3">
                <LogIn size={18} /> Login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-ink-faint mt-6">Rozy POS</p>
      </motion.div>
    </div>
  );
}
