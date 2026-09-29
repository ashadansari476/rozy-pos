import { useState } from "react";
import { useApp } from "../stores/appStore";
import { Delete, LogIn } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [mode, setMode] = useState("pin");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useApp((s) => s.login);

  const press = (d) => { if (pin.length < 4) setPin(pin + d); };
  const back = () => setPin(pin.slice(0, -1));

  const submitPin = async () => {
    const res = await login({ pin });
    if (!res.ok) {
      setError("Wrong PIN");
      setPin("");
      setTimeout(() => setError(""), 1500);
    }
  };

  const submitCashier = async () => {
    const res = await login({ username, password });
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🧁</div>
          <h1 className="font-serif text-3xl text-primary font-semibold">
            Rozy Sweet, Snacks & Bakery
          </h1>
          <p className="text-ink-muted text-sm mt-1">Sukhia Pokhri · Darjeeling</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-6 bg-bg p-1 rounded-xl">
            <button
              onClick={() => { setMode("pin"); setError(""); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                mode === "pin" ? "bg-surface shadow-warm text-primary" : "text-ink-muted"
              }`}
            >
              Owner
            </button>
            <button
              onClick={() => { setMode("cashier"); setError(""); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                mode === "cashier" ? "bg-surface shadow-warm text-primary" : "text-ink-muted"
              }`}
            >
              Cashier
            </button>
          </div>

          {mode === "pin" ? (
            <>
              <p className="text-center text-ink-muted text-sm mb-4">
                Enter your 4-digit PIN
              </p>

              <div className="flex justify-center gap-3 mb-6">
                {[0,1,2,3].map((i) => (
                  <div key={i} className={`pin-dot ${pin.length > i ? "filled" : ""}`} />
                ))}
              </div>

              {error && (
                <div className="text-center text-danger text-sm mb-3 animate-fadeUp">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9].map((d) => (
                  <button
                    key={d}
                    onClick={() => press(String(d))}
                    className="aspect-square rounded-xl2 bg-bg hover:bg-primary-light
                               text-2xl font-semibold font-mono text-ink transition"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={back}
                  className="aspect-square rounded-xl2 bg-bg hover:bg-primary-light
                             flex items-center justify-center text-ink transition"
                >
                  <Delete size={24} />
                </button>
                <button
                  onClick={() => press("0")}
                  className="aspect-square rounded-xl2 bg-bg hover:bg-primary-light
                             text-2xl font-semibold font-mono text-ink transition"
                >
                  0
                </button>
                <button
                  onClick={submitPin}
                  disabled={pin.length !== 4}
                  className="aspect-square rounded-xl2 bg-primary text-white
                             hover:bg-primary-hover disabled:bg-border disabled:text-ink-faint
                             flex items-center justify-center transition"
                >
                  <LogIn size={24} />
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="label">Username</label>
              <input
                className="input mb-4"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cashier1"
              />
              <label className="label">Password</label>
              <input
                className="input mb-6"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
              {error && (
                <div className="text-danger text-sm mb-3 text-center">{error}</div>
              )}
              <button onClick={submitCashier} className="btn-primary w-full py-3">
                <LogIn size={18} /> Login
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-faint mt-6">
          Powered by Rozy POS · v1.0
        </p>
      </motion.div>
    </div>
  );
}