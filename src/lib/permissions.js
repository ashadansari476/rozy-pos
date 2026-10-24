// ============================================================
// ROZY POS — Role-Based Permissions
// ============================================================

// Role definitions:
// - owner   : Full access, both shops, all features
// - cashier : Limited access, one shop, billing + inventory + orders

export const ROLES = {
  owner: {
    label: "Owner",
    // Pages accessible
    pages: [
  "billing", "dashboard", "day-end", "compare",
  "products", "inventory", "suppliers",
  "customers", "orders", "reports",
  "expenses", "targets", "audit", "settings",
],
    // Can switch shops
    canSwitchShops: true,
    // Can see profit/margins/costs
    canSeeFinancials: true,
    // Can edit products
    canEditProducts: true,
    canChangePrices: true,
    canIssueRefunds: true,
    // Can delete records
    canDelete: true,
    // Can access settings + backup + cloud sync
    canAccessSettings: true,
    // Can manage cash drawer
    canManageCash: true,
    // Can see both shops
    seesAllShops: true,
  },
  cashier: {
    label: "Cashier",
    // Limited pages
    pages: [
      "billing", "inventory", "orders", "customers",
    ],
    canSwitchShops: false,
    canSeeFinancials: false, // No cost/margin/profit
    canEditProducts: false,
    canChangePrices: false,
    canIssueRefunds: false,
    canDelete: false,
    canAccessSettings: false,
    canManageCash: false,
    seesAllShops: false,
  },
};

// Get permissions for a role
export function getPermissions(role) {
  return ROLES[role] || ROLES.cashier;
}

// Check if user can access a page
export function canAccessPage(user, page) {
  if (!user) return false;
  const perms = getPermissions(user.role);
  return perms.pages.includes(page);
}

// Check if user can switch shops
export function canSwitchShops(user) {
  return user && getPermissions(user.role).canSwitchShops;
}

// Check if user can see financials
export function canSeeFinancials(user) {
  return user && getPermissions(user.role).canSeeFinancials;
}

// Check if user can edit products
export function canEditProducts(user) {
  return user && getPermissions(user.role).canEditProducts;
}

// Check if user can delete
export function canDelete(user) {
  return user && getPermissions(user.role).canDelete;
}

// Check if user can access settings
export function canAccessSettings(user) {
  return user && getPermissions(user.role).canAccessSettings;
}

// Check if user can manage cash drawer
export function canManageCash(user) {
  return user && getPermissions(user.role).canManageCash;
}

// Filter nav items by permissions
export function filterNavByPermissions(user, navItems) {
  if (!user) return [];
  const perms = getPermissions(user.role);
  return navItems.filter((item) => {
    // Key must be in allowed pages
    const key = item.key || "";
    return perms.pages.includes(key);
  });
}
export function canChangePrices(user) { return !!user && getPermissions(user.role).canChangePrices === true; }
export function canIssueRefunds(user) { return !!user && getPermissions(user.role).canIssueRefunds === true; }
