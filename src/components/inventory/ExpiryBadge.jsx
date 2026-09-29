import { AlertTriangle, Clock, Check } from "lucide-react";

export default function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return null;

  const now = Date.now();
  const diff = expiryDate - now;
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-danger/10 text-danger">
        <AlertTriangle size={11} /> Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-danger/10 text-danger">
        <AlertTriangle size={11} /> Expires today
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-warning/10 text-warning">
        <Clock size={11} /> {days}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-success/10 text-success">
      <Check size={11} /> {days}d left
    </span>
  );
}