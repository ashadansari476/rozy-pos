import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { Plus, Trash2, Save } from "lucide-react";
import ImageUploader from "./ImageUploader";

const UNITS = ["piece", "kg", "gram", "packet", "dozen", "litre"];

export default function ProductModal({ open, onClose, onSave, product, categories }) {
  const [form, setForm] = useState(defaultForm());
  const [variants, setVariants] = useState([]);
  const [imageBlob, setImageBlob] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        category: product.category || "",
        unit: product.unit || "piece",
        price: product.price ?? "",
        cost: product.cost ?? "",
        stock: product.stock ?? "",
        lowStock: product.lowStock ?? 5,
        barcode: product.barcode || "",
      });
      setVariants(product.variants || []);
      setImageDataUrl(product.imageUrl || product.imageDataUrl || null);
      setImageBlob(null);
    } else {
      setForm(defaultForm());
      setVariants([]);
      setImageDataUrl(null);
      setImageBlob(null);
    }
  }, [product, open]);

  function defaultForm() {
    return {
      name: "",
      category: categories[0]?.name || "Bakery",
      unit: "piece",
      price: "",
      cost: "",
      stock: "",
      lowStock: 5,
      barcode: "",
    };
  }

  const update = (key, val) => setForm({ ...form, [key]: val });

  const addVariant = () =>
    setVariants([...variants, { label: "", price: "", stock: "" }]);

  const updateVariant = (idx, key, val) => {
    const v = [...variants];
    v[idx][key] = val;
    setVariants(v);
  };

  const removeVariant = (idx) =>
    setVariants(variants.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!form.name.trim()) return alert("Product name is required");
    if (!form.price && variants.length === 0)
      return alert("Enter a price or add variants");

    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      lowStock: parseFloat(form.lowStock) || 0,
      barcode: form.barcode.trim(),
      variants: variants.map((v) => ({
        label: v.label,
        price: parseFloat(v.price) || 0,
        stock: parseFloat(v.stock) || 0,
      })),
      imageDataUrl: imageBlob ? null : (product?.imageDataUrl || null),
      imageUrl: imageBlob ? null : (product?.imageUrl || null),
    };

    onSave({ ...payload, _imageBlob: imageBlob });
  };

  const margin =
    form.cost && form.price && parseFloat(form.price) > 0
      ? ((parseFloat(form.price) - parseFloat(form.cost)) / parseFloat(form.price)) * 100
      : null;

  return (
    <Modal open={open} onClose={onClose} title={product ? "Edit Product" : "Add Product"} size="lg">
      <div className="space-y-4">
        <div>
          <label className="label">Product Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Kaju Katli"
            autoFocus
          />
        </div>

        <ImageUploader
          value={imageDataUrl}
          onChange={(val) => {
            if (!val) {
              setImageBlob(null);
              setImageDataUrl(null);
            } else {
              setImageBlob(val.blob);
              setImageDataUrl(val.dataUrl);
            }
          }}
          productName={form.name}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <select
              className="input"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Selling Price (₹) *</label>
            <input
              className="input font-mono"
              type="number"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Cost Price (₹)</label>
            <input
              className="input font-mono"
              type="number"
              value={form.cost}
              onChange={(e) => update("cost", e.target.value)}
              placeholder="0.00 (optional)"
            />
            {margin !== null && (
              <div className={`text-xs mt-1 ${margin >= 20 ? "text-success" : "text-warning"}`}>
                Margin: {margin.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Stock</label>
            <input
              className="input font-mono"
              type="number"
              value={form.stock}
              onChange={(e) => update("stock", e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Low Stock Alert</label>
            <input
              className="input font-mono"
              type="number"
              value={form.lowStock}
              onChange={(e) => update("lowStock", e.target.value)}
              placeholder="5"
            />
          </div>
        </div>

        <div>
          <label className="label">Barcode (optional)</label>
          <input
            className="input font-mono"
            value={form.barcode}
            onChange={(e) => update("barcode", e.target.value)}
            placeholder="Scan or type barcode"
          />
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm text-ink">Pack Sizes (Variants)</div>
              <div className="text-xs text-ink-muted">
                Optional — e.g. Cookies 250g / 500g / 1kg with different prices
              </div>
            </div>
            <button onClick={addVariant} className="btn-outline py-1.5 px-3 text-xs">
              <Plus size={14} /> Add Size
            </button>
          </div>

          {variants.length === 0 ? (
            <div className="text-xs text-ink-faint text-center py-3 bg-bg/45 rounded-lg">
              No variants — product will use the price above
            </div>
          ) : (
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder="Label (e.g. 250g)"
                    value={v.label}
                    onChange={(e) => updateVariant(i, "label", e.target.value)}
                  />
                  <input
                    className="input w-28 font-mono"
                    type="number"
                    placeholder="Price"
                    value={v.price}
                    onChange={(e) => updateVariant(i, "price", e.target.value)}
                  />
                  <input
                    className="input w-24 font-mono"
                    type="number"
                    placeholder="Stock"
                    value={v.stock}
                    onChange={(e) => updateVariant(i, "stock", e.target.value)}
                  />
                  <button
                    onClick={() => removeVariant(i)}
                    className="p-2 text-danger hover:bg-danger/10 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary">
          <Save size={16} /> Save Product
        </button>
      </div>
    </Modal>
  );
}