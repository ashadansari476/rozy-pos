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

export default function App() {
  const user = useApp((s) => s.user);
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/billing" replace />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/day-end" element={<DayEnd />} />
        <Route path="/settings" element={<Settings />} />
<Route path="/settings/shops" element={<ShopSettings />} />
<Route path="/settings/cashiers" element={<Cashiers />} />
        <Route path="*" element={<Navigate to="/billing" replace />} />
        <Route path="/settings/sync" element={<SyncSettings />} />
        <Route path="/compare" element={<CompareShops />} />
        <Route path="/theme-preview" element={<ThemePreview />} />      
      </Route>
    </Routes>
  );
}