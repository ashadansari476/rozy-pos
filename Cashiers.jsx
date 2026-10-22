import { useEffect, useState } from "react";
import { useApp } from "../stores/appStore";
import { useShop } from "../stores/shopStore";
import {
  getAllCashiers, addCashier, updateCashier, deleteCashier,
} from "../lib/shops";
import Modal from "../components/ui/Modal";
import { Users, Plus, Edit2, Trash2, User, Store } from "lucide-react";

export default function Cashiers() {
  const user = useApp((s) => s.user);
  const { shops } = useShop();
  const [cashiers, setCashiers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const all = await getAllCashiers();
    setCashiers(all);
  };

  useEffect(() => {
    load();
  }, []);

  // Only owner can manage cashiers
  if (user.role !== "owner") {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Only the owner can manage cashiers.
      </div>
    );
  }

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setShowModal(true);
  };

  const handleSave = async () => {
    const username = document.getElementById("cashierUsername").value.trim();
    const password = document.getElementById("cashierPassword").value;
    const shopId = document.getElementById("cashierShop").value;

    if (!username) return alert("Username required");
    if (!editing && !password) return alert("Password required for new cashier");
    if (password && password.length < 6) return alert("Password must be 6+ characters");

    try {
      if (editing) {
        await updateCashier(editing.id, {
          username,
          ...(password ? { password } : {}),
          shopId,
        });
      } else {
        await addCashier({ username, password, shopId });
      }
      setShowModal(false);
      setEditing(null);
      await load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete cashier "${c.username}"?`)) return;
    try {
      await deleteCashier(c.id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
            <Users size={24} /> Cashiers
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {cashiers.length} cashier{cashiers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm">
          <Plus size={16} /> Add Cashier
        </button>
      </div>

      {cashiers.length === 0 ? (
        <div className="card p-12 text-center max-w-md mx-auto mt-8">
          <Users size={48} className="mx-auto text-ink-faint mb-4" />
          <h2 className="font-serif text-xl text-primary font-semibold mb-2">
            No cashiers yet
          </h2>
          <p className="text-ink-muted text-sm mb-5">
            Add cashiers for each shop. They'll log in with their own username and password.
          </p>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Add First Cashier
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cashiers.map((c) => {
            const shop = shops.find((s) => s.id === c.shopId);
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-accent-light text-accent font-bold text-lg flex items-center justify-center flex-shrink-0">
                    {c.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{c.username}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                      <Store size={10} />
                      {shop?.shortName || "Unknown shop"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="btn-outline flex-1 py-1.5 text-xs">
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="btn-outline py-1.5 px-3 text-xs text-danger hover:border-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Edit Cashier" : "Add Cashier"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Username *</label>
            <input
              id="cashierUsername"
              className="input"
              defaultValue={editing?.username || ""}
              placeholder="e.g. rahul"
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              Password {editing ? "(leave blank to keep current)" : "*"}
            </label>
            <input
              id="cashierPassword"
              type="password"
              className="input"
              placeholder={editing ? "••••••" : "Min 4 characters"}
            />
          </div>
          <div>
            <label className="label">Assigned Shop *</label>
            <select
              id="cashierShop"
              className="input"
              defaultValue={editing?.shopId || shops[0]?.id}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName} — {s.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-ink-muted mt-1">
              Cashier will only see data for their assigned shop
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={() => { setShowModal(false); setEditing(null); }}
            className="btn-outline"
          >
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {editing ? "Save Changes" : "Create Cashier"}
          </button>
        </div>
      </Modal>
    </div>
  );
}