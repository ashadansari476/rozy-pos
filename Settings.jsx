import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store, Users, Settings as SettingsIcon, ChevronRight, Cloud, Database, KeyRound,
} from "lucide-react";
import Modal from "../components/ui/Modal";
import { showToast } from "../components/ui/Toast";
import { verifyOwnerPin, setOwnerPin, isWeakPin } from "../lib/auth";

function ChangePinModal({ open, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCurrent(""); setNext(""); setAgain(""); setError("");
    onClose();
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!(await verifyOwnerPin(current))) return setError("Current PIN is wrong");
    if (isWeakPin(next)) return setError("Use 4-6 digits that are not obvious (no 1234, 0000, repeats)");
    if (next !== again) return setError("The new PINs do not match");
    setBusy(true);
    try {
      await setOwnerPin(next);
      showToast("Owner PIN changed", "success");
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, value, set) => (
    <div className="mb-4">
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={close} title="Change owner PIN" size="sm">
      <form onSubmit={save}>
        {field("pin-current", "Current PIN", current, setCurrent)}
        {field("pin-new", "New PIN (4-6 digits)", next, setNext)}
        {field("pin-again", "Repeat new PIN", again, setAgain)}
        {error && <div className="text-danger text-sm mb-3" role="alert">{error}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          Save PIN
        </button>
      </form>
    </Modal>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState(false);

  const items = [
    {
      icon: Store,
      label: "Shops",
      desc: "Manage shops, names, addresses, bill prefixes",
      to: "/settings/shops",
    },
    {
      icon: Users,
      label: "Cashiers",
      desc: "Add cashiers and assign them to shops",
      to: "/settings/cashiers",
    },
    {
      icon: Cloud,
      label: "Cloud Sync",
      desc: "Sync products between your shops via Supabase",
      to: "/settings/sync",
    },
    {
      icon: Database,
      label: "Backup & Restore",
      desc: "Download your full database as a file, or restore from a backup",
      to: "/settings/backup",
    },
    {
      icon: KeyRound,
      label: "Owner PIN",
      desc: "Change the PIN you use to log in as owner",
      action: () => setPinOpen(true),
    },
    {
      icon: SettingsIcon,
      label: "Preferences",
      desc: "Language, theme, keyboard shortcuts",
      to: "/settings/preferences",
      disabled: true,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <h1 className="font-serif text-2xl text-primary font-semibold mb-1">
        Settings
      </h1>
      <p className="text-xs text-ink-muted mb-6">
        Configure your shops, cashiers, and preferences
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(({ icon: Icon, label, desc, to, disabled, action }) => (
          <button
            key={label}
            onClick={() => !disabled && (action ? action() : navigate(to))}
            disabled={disabled}
            className={`card p-5 text-left flex items-start gap-3 transition ${
              disabled
                ? "opacity-60 cursor-not-allowed"
                : "hover:border-primary hover:shadow-warmH cursor-pointer"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink flex items-center justify-between">
                {label}
                {!disabled && <ChevronRight size={16} className="text-ink-faint" />}
              </div>
              <div className="text-xs text-ink-muted mt-1">{desc}</div>
            </div>
          </button>
        ))}
      </div>

      <ChangePinModal open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}