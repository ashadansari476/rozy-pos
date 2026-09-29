import { useNavigate } from "react-router-dom";
import {
  Store, Users, Settings as SettingsIcon, ChevronRight, Cloud,
} from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();

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
        {items.map(({ icon: Icon, label, desc, to, disabled }) => (
          <button
            key={label}
            onClick={() => !disabled && navigate(to)}
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
    </div>
  );
}