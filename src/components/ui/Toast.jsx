import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, X, Info } from "lucide-react";

// Global toast store
let toasts = [];
let listeners = [];

function notify() {
  for (const fn of listeners) fn([...toasts]);
}

export function showToast(message, type = "info", duration = 4000) {
  const id = Date.now() + Math.random();
  toasts.push({ id, message, type, duration });
  notify();

  if (duration > 0) {
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      notify();
    }, duration);
  }

  return id;
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export default function ToastContainer() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const listener = (t) => setItems(t);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((fn) => fn !== listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[5000] flex flex-col gap-2 pointer-events-none"
      style={{ top: "calc(12px + env(safe-area-inset-top, 0px))" }}
    >
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }) {
  const meta = {
    success: {
      icon: CheckCircle,
      bg: "bg-success",
      ring: "ring-success/20",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-warning",
      ring: "ring-warning/20",
    },
    error: {
      icon: AlertTriangle,
      bg: "bg-danger",
      ring: "ring-danger/20",
    },
    info: {
      icon: Info,
      bg: "bg-primary",
      ring: "ring-primary/20",
    },
  }[toast.type] || {
    icon: Info,
    bg: "bg-primary",
    ring: "ring-primary/20",
  };

  const Icon = meta.icon;

  return (
    <div
      className={`pointer-events-auto ${meta.bg} text-white rounded-xl shadow-warmH
                  px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-[90vw] sm:max-w-md
                  ring-4 ${meta.ring} animate-slideUp`}
      style={{ animation: "slideUp 0.25s ease-out" }}
    >
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium leading-snug whitespace-pre-line">
        {toast.message}
      </div>
      <button
        onClick={() => dismissToast(toast.id)}
        className="flex-shrink-0 p-0.5 hover:bg-white/20 rounded transition"
      >
        <X size={14} />
      </button>
    </div>
  );
}