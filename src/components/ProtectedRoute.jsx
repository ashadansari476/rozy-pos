import { Navigate } from "react-router-dom";
import { useApp } from "../../stores/appStore";
import { getPermissions } from "../../lib/permissions";

// Wraps a route and checks if user can access it
// pageKey: matches the "key" used in permissions.js pages array
export default function ProtectedRoute({ pageKey, children }) {
  const user = useApp((s) => s.user);

  if (!user) {
    // Not logged in — send to login (App.jsx handles this)
    return <Navigate to="/" replace />;
  }

  const perms = getPermissions(user.role);
  const allowed = perms.pages.includes(pageKey);

  if (!allowed) {
    // Not authorized — redirect to billing
    return <Navigate to="/billing" replace />;
  }

  return children;
}