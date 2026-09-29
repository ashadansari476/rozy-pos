import { useEffect, useState } from "react";
import { useProducts } from "../stores/productStore";
import { useTranslation } from "react-i18next";
import ProductModal from "../components/products/ProductModal";
import CategoryManager from "../components/products/CategoryManager";
import CSVImport from "../components/products/CSVImport";
import {
  Package, Plus, Search, Upload, Settings2, Edit2, Trash2,
  AlertTriangle, Barcode
} from "lucide-react";
import SearchInput from "../components/ui/SearchInput";
import { uploadProductImage, deleteProductImage } from "../lib/imageStorage";
import ProductImage from "../components/products/ProductImage";

export default function Products() {
  const { t } = useTranslation();
  const {
    products, categories, loading,
    load, add, update, remove, bulkImport,
    addCategory, updateCategory, removeCategory,
    search, setSearch, activeCategory, setCategory, filtered,
  } = useProducts();

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const list = filtered();

    const handleSave = async (payload) => {
    const { _imageBlob, ...dataToSave } = payload;

    // Save product first (to get ID)
    let productId;
    if (editingProduct) {
      productId = editingProduct.id;
      await update(productId, dataToSave);
    } else {
      productId = await add(dataToSave);
    }

    // If new image, upload it
    if (_imageBlob) {
      try {
        // If editing and had an old image, delete it
        if (editingProduct?.imageUrl) {
          await deleteProductImage(editingProduct.imageUrl);
        }

        const imageUrl = await uploadProductImage(productId, _imageBlob);
        if (imageUrl) {
          // Update product with the URL
          await update(productId, { ...dataToSave, imageUrl });
        }
      } catch (e) {
        console.warn("Image upload failed, keeping local only:", e.message);
        // Keep local data URL as fallback
        const { blobToDataURL } = await import("../lib/imageUtils");
        const dataUrl = await blobToDataURL(_imageBlob);
        await update(productId, { ...dataToSave, imageDataUrl: dataUrl });
      }
    }

    setShowProductModal(false);
    setEditingProduct(null);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const handleDelete = async (p) => {
    if (confirm(`Delete "${p.name}"?`)) {
      await remove(p.id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl text-primary font-semibold">
              {t("products")}
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {products.length} products · {categories.length} categories
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCategoryMgr(true)}
              className="btn-outline text-xs sm:text-sm py-2 px-3"
            >
              <Settings2 size={14} /> <span className="hidden sm:inline">Categories</span>
            </button>
            <button
              onClick={() => setShowCSVImport(true)}
              className="btn-outline text-xs sm:text-sm py-2 px-3"
            >
              <Upload size={14} /> <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowProductModal(true);
              }}
              className="btn-primary text-xs sm:text-sm py-2 px-3"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Search */}
                <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("search_products")}
          className="mb-3"
        />

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("All")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === "All"
                ? "bg-primary text-white shadow-warm"
                : "bg-bg text-ink hover:bg-primary-light"
            }`}
          >
            All ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.name)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                  activeCategory === cat.name
                    ? "bg-primary text-white shadow-warm"
                    : "bg-bg text-ink hover:bg-primary-light"
                }`}
              >
                {cat.icon} {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 text-ink-muted">Loading...</div>
        ) : list.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto mt-8">
            <Package size={48} className="mx-auto text-ink-faint mb-4" />
            <h2 className="font-serif text-xl text-primary font-semibold mb-2">
              No products yet
            </h2>
            <p className="text-ink-muted text-sm mb-5">
              {products.length === 0
                ? "Add your first product, or import 200+ items at once from a CSV file."
                : "No products match your search."}
            </p>
            {products.length === 0 && (
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowCSVImport(true)}
                  className="btn-outline text-sm"
                >
                  <Upload size={16} /> Import CSV
                </button>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="btn-primary text-sm"
                >
                  <Plus size={16} /> Add Manually
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg">
                  <tr className="text-left">
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider">Name</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider">Category</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider">Unit</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Cost</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Price</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Margin</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Stock</th>
                    <th className="p-3 font-semibold text-ink-muted text-xs uppercase tracking-wider">Barcode</th>
                    <th className="p-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const low = p.stock <= p.lowStock;
                    const margin = p.cost && p.price > 0
                      ? ((p.price - p.cost) / p.price) * 100
                      : null;
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-bg/50">
                                                <td className="p-3">
                          <div className="flex items-center gap-2">
                            <ProductImage product={p} size="sm" />
                            <div>
                              <div className="font-semibold text-ink">{p.name}</div>
                              {p.variants && p.variants.length > 0 && (
                                <div className="text-xs text-ink-muted">
                                  {p.variants.length} pack size{p.variants.length > 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-ink-muted">{p.category}</td>
                        <td className="p-3 text-ink-muted">{p.unit}</td>
                        <td className="p-3 text-right font-mono text-ink-muted">
                          {p.cost ? `₹${p.cost}` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-primary">
                          ₹{p.price}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {margin !== null ? (
                            <span className={margin >= 20 ? "text-success font-semibold" : "text-warning font-semibold"}>
                              {margin.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span className={low ? "text-warning font-semibold" : ""}>
                            {p.stock}
                          </span>
                          {low && <AlertTriangle size={12} className="inline ml-1 text-warning" />}
                        </td>
                        <td className="p-3 font-mono text-xs text-ink-muted">
                          {p.barcode ? (
                            <span className="flex items-center gap-1">
                              <Barcode size={12} /> {p.barcode}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-2 text-ink-muted hover:text-primary hover:bg-primary-light rounded-lg"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-2 text-ink-muted hover:text-danger hover:bg-danger/10 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ProductModal
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSave={handleSave}
        product={editingProduct}
        categories={categories}
      />

      <CategoryManager
        open={showCategoryMgr}
        onClose={() => setShowCategoryMgr(false)}
        categories={categories}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onRemove={removeCategory}
      />

      <CSVImport
        open={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onImport={bulkImport}
      />
    </div>
  );
}