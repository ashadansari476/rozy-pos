import { useEffect, useState } from "react";
import { useInventory } from "../stores/inventoryStore";
import { useApp } from "../stores/appStore";
import { addSupplier, updateSupplier, deleteSupplier, getPurchases } from "../lib/inventory";
import PurchaseModal from "../components/inventory/PurchaseModal";
import Modal from "../components/ui/Modal";
import {
  Truck, Plus, Phone, Edit2, Trash2, ShoppingCart, MapPin,
} from "lucide-react";

export default function Suppliers() {
  const user = useApp((s) => s.user);
  const { suppliers, products, reloadSuppliers, refresh } = useInventory();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    reloadSuppliers();
    refresh();
    (async () => {
      const p = await getPurchases({});
      setPurchases(p);
    })();
  }, []);

  const refreshPurchases = async () => {
    const p = await getPurchases({});
    setPurchases(p);
  };

  const handleSave = async () => {
    const name = document.getElementById("supName").value.trim();
    const phone = document.getElementById("supPhone").value.trim();
    const address = document.getElementById("supAddress").value.trim();
    const supplies = document.getElementById("supSupplies").value.trim();

    if (!name) return alert("Name required");

    if (editing) {
      await updateSupplier(editing.id, { name, phone, address, supplies });
    } else {
      await addSupplier({ name, phone, address, supplies });
    }
    setShowAdd(false);
    setEditing(null);
    reloadSuppliers();
  };

  const handleDelete = async (s) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await deleteSupplier(s.id);
    reloadSuppliers();
  };

  const openAdd = () => {
    setEditing(null);
    setShowAdd(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setShowAdd(true);
  };

  const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
              <Truck size={24} /> Suppliers
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {suppliers.length} suppliers · {purchases.length} purchases
            </p>
          </div>
          <button onClick={() => setShowPurchase(true)} className="btn-outline text-sm">
            <ShoppingCart size={16} /> Record Purchase
          </button>
          <button onClick={openAdd} className="btn-primary text-sm">
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Purchase summary */}
        <div className="card p-5 mb-5">
          <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
            Total Purchases (all time)
          </div>
          <div className="font-mono text-3xl font-bold text-primary mt-1">
            ₹{totalPurchases.toFixed(2)}
          </div>
          <div className="text-xs text-ink-muted mt-1">
            {purchases.length} purchase entries
          </div>
        </div>

        {/* Supplier list */}
        {suppliers.length === 0 ? (
          <div className="card p-12 text-center">
            <Truck size={48} className="mx-auto text-ink-faint mb-4" />
            <h2 className="font-serif text-xl text-primary font-semibold mb-2">
              No suppliers yet
            </h2>
            <p className="text-ink-muted text-sm mb-5">
              Add your first supplier to track purchases and stock coming in.
            </p>
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16} /> Add Supplier
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => {
              const supplierPurchases = purchases.filter((p) => p.supplierId === s.id);
              const total = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
              return (
                <div key={s.id} className="card p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                      <Truck size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink truncate">{s.name}</div>
                      {s.supplies && (
                        <div className="text-xs text-ink-muted truncate">{s.supplies}</div>
                      )}
                    </div>
                  </div>

                  {s.phone && (
                    <div className="flex items-center gap-2 text-xs text-ink-muted mb-1">
                      <Phone size={12} /> {s.phone}
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                      <MapPin size={12} /> {s.address}
                    </div>
                  )}

                  <div className="bg-bg rounded-xl p-3 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">Purchases</span>
                      <span className="font-mono font-semibold">{supplierPurchases.length}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-ink-muted">Total value</span>
                      <span className="font-mono font-semibold text-primary">
                        ₹{total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)} className="btn-outline flex-1 py-1.5 text-xs">
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="btn-outline py-1.5 text-xs text-danger hover:border-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Supplier Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        title={editing ? "Edit Supplier" : "Add Supplier"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              id="supName"
              className="input"
              defaultValue={editing?.name || ""}
              placeholder="e.g. Sharma Sweets Wholesale"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              id="supPhone"
              className="input"
              defaultValue={editing?.phone || ""}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              id="supAddress"
              className="input"
              defaultValue={editing?.address || ""}
              placeholder="City / area"
            />
          </div>
          <div>
            <label className="label">Supplies</label>
            <input
              id="supSupplies"
              className="input"
              defaultValue={editing?.supplies || ""}
              placeholder="e.g. Dry fruits, sugar, flour"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={() => { setShowAdd(false); setEditing(null); }}
            className="btn-outline"
          >
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {editing ? "Save Changes" : "Add Supplier"}
          </button>
        </div>
      </Modal>

      {/* Purchase Modal */}
      <PurchaseModal
        open={showPurchase}
        onClose={() => setShowPurchase(false)}
        products={products}
        suppliers={suppliers}
        onSaved={() => { refreshPurchases(); refresh(); }}
      />
    </div>
  );
}