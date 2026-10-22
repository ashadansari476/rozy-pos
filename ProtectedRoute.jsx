import { Navigate } from "react-router-dom";
import { useApp } from "../../stores/appStore";
import { getPermissions } from "../../lib/permissions";

export default function ProtectedRoute({ pageKey, children }) {
  const user = useApp((s) => s.user);

  if (!user) return <Navigate to="/" replace />;

  const perms = getPermissions(user.role);
  const allowed = perms.pages.includes(pageKey);

  if (!allowed) return <Navigate to="/billing" replace />;

  return children;
}
