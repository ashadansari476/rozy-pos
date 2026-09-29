import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { updateShop, addShop, deleteShop } from "../lib/shops";
import ShopEditModal from "../components/settings/ShopEditModal";
import { Store, Plus, Edit2, Trash2, Check } from "lucide-react";

export default function ShopSettings() {
  const { shops, loadShops, currentShopId, switchShop } = useShop();
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  const openEdit = (shop) => {
    setEditing(shop);
    setShowModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await updateShop(editing.id, data);
      } else {
        await addShop(data);
      }
      setShowModal(false);
      setEditing(null);
      await loadShops();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  };

  const handleDelete = async (shop) => {
    if (shops.length <= 1) {
      alert("Cannot delete the last shop");
      return;
    }
    if (!confirm(`Delete "${shop.name}"? All data for this shop stays in DB but becomes inaccessible.`)) return;
    await deleteShop(shop.id);
    if (currentShopId === shop.id && shops[0]?.id !== shop.id) {
      switchShop(shops.find((s) => s.id !== shop.id).id);
    }
    await loadShops();
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
            <Store size={24} /> Shops
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {shops.length} shop{shops.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm">
          <Plus size={16} /> Add Shop
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {shops.map((shop) => {
          const isCurrent = shop.id === currentShopId;
          return (
            <div key={shop.id} className={`card p-5 ${isCurrent ? "border-primary border-2" : ""}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl2 bg-primary text-white flex items-center justify-center text-xl flex-shrink-0">
                  🧁
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-serif font-semibold text-lg text-primary truncate">
                      {shop.shortName}
                    </div>
                    {isCurrent && (
                      <span className="text-xs bg-success text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted truncate">{shop.name}</div>
                </div>
              </div>

              <div className="space-y-1 mb-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">ID</span>
                  <span className="font-mono">{shop.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Bill Prefix</span>
                  <span className="font-mono font-semibold">{shop.billPrefix}-0001</span>
                </div>
                {shop.address && (
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Address</span>
                    <span className="text-right">{shop.address}</span>
                  </div>
                )}
                {shop.phone && (
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Phone</span>
                    <span>{shop.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!isCurrent && (
                  <button
                    onClick={() => switchShop(shop.id)}
                    className="btn-outline flex-1 py-1.5 text-xs"
                  >
                    Switch to this shop
                  </button>
                )}
                <button onClick={() => openEdit(shop)} className="btn-outline py-1.5 px-3 text-xs">
                  <Edit2 size={12} />
                </button>
                {shops.length > 1 && (
                  <button
                    onClick={() => handleDelete(shop)}
                    className="btn-outline py-1.5 px-3 text-xs text-danger hover:border-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ShopEditModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        shop={editing}
        onSave={handleSave}
      />
    </div>
  );
}