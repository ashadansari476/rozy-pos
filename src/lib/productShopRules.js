// Legacy product rows without shopId belong to Rozy only.
export function productBelongsToShop(product, shopId) {
  return !!product && (product.shopId || "rozy") === shopId;
}
export function filterProductsForShop(products, shopId) {
  return products.filter((product) => productBelongsToShop(product, shopId));
}


/**
 * One bakery's inventory grid: filter the catalogue first, then join only
 * stock records from that bakery. Never infer stock from a different shop or
 * from the product catalogue itself.
 */
export function withShopStock(products, stockRecords, shopId) {
  const stockByProduct = new Map(
    stockRecords.filter((row) => row.shopId === shopId)
      .map((row) => [row.productId, row])
  );
  return filterProductsForShop(products, shopId).map((product) => {
    const stockRecord = stockByProduct.get(product.id);
    return {
      ...product,
      stock: stockRecord?.stock ?? 0,
      lowStock: stockRecord?.lowStock ?? product.lowStock ?? 5,
    };
  });
}
