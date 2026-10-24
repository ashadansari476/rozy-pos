// Legacy product rows without shopId belong to Rozy only.
export function productBelongsToShop(product, shopId) {
  return !!product && (product.shopId || "rozy") === shopId;
}
export function filterProductsForShop(products, shopId) {
  return products.filter((product) => productBelongsToShop(product, shopId));
}
