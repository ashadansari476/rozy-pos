import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./stores/appStore";
import Login from "./screens/Login";
import AppShell from "./shell/AppShell";
import Billing from "./screens/Billing";
import Dashboard from "./screens/Dashboard";
import Products from "./screens/Products";
import Placeholder from "./screens/Placeholder";
import Reports from "./screens/Reports";
import Inventory from "./screens/Inventory";
import Suppliers from "./screens/Suppliers";
import Customers from "./screens/Customers";
import Orders from "./screens/Orders";
import ShopSettings from "./screens/ShopSettings";
import Cashiers from "./screens/Cashiers";
import Settings from "./screens/Settings";
import SyncSettings from "./screens/SyncSettings";
import Expenses from "./screens/Expenses";
import Targets from "./screens/Targets";
import AuditLog from "./screens/AuditLog";
import DayEnd from "./screens/DayEnd";
import CompareShops from "./screens/CompareShops";
import ThemePreview from "./screens/ThemePreview";
import Backup from "./screens/Backup";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ToastContainer from "./components/ui/Toast";

export default function App() {
  const user = useApp((s) => s.user);
  if (!user) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
    <ToastContainer />
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/billing" replace />} />

        {/* Cashier accessible */}
        <Route path="/billing" element={<ProtectedRoute pageKey="billing"><Billing /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute pageKey="products"><Products /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute pageKey="inventory"><Inventory /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute pageKey="customers"><Customers /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute pageKey="orders"><Orders /></ProtectedRoute>} />

        {/* Owner only */}
        <Route path="/dashboard" element={<ProtectedRoute pageKey="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute pageKey="suppliers"><Suppliers /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute pageKey="reports"><Reports /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute pageKey="expenses"><Expenses /></ProtectedRoute>} />
        <Route path="/targets" element={<ProtectedRoute pageKey="targets"><Targets /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute pageKey="audit"><AuditLog /></ProtectedRoute>} />
        <Route path="/day-end" element={<ProtectedRoute pageKey="day-end"><DayEnd /></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute pageKey="compare"><CompareShops /></ProtectedRoute>} />
        <Route path="/theme-preview" element={<ProtectedRoute pageKey="dashboard"><ThemePreview /></ProtectedRoute>} />

        {/* Settings — all protected by "settings" key */}
        <Route path="/settings" element={<ProtectedRoute pageKey="settings"><Settings /></ProtectedRoute>} />
        <Route path="/settings/shops" element={<ProtectedRoute pageKey="settings"><ShopSettings /></ProtectedRoute>} />
        <Route path="/settings/cashiers" element={<ProtectedRoute pageKey="settings"><Cashiers /></ProtectedRoute>} />
        <Route path="/settings/sync" element={<ProtectedRoute pageKey="settings"><SyncSettings /></ProtectedRoute>} />
        <Route path="/settings/backup" element={<ProtectedRoute pageKey="settings"><Backup /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/billing" replace />} />
      </Route>
    </Routes>
    </>
  );
}