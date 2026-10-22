import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { Save, Store } from "lucide-react";

export default function ShopEditModal({ open, onClose, shop, onSave }) {
  const [form, setForm] = useState({
    id: "",
    name: "",
    shortName: "",
    address: "",
    phone: "",
    billPrefix: "",
  });

  useEffect(() => {
    if (shop) {
      setForm({
        id: shop.id || "",
        name: shop.name || "",
        shortName: shop.shortName || "",
        address: shop.address || "",
        phone: shop.phone || "",
        billPrefix: shop.billPrefix || "",
      });
    } else {
      setForm({
        id: "",
        name: "",
        shortName: "",
        address: "",
        phone: "",
        billPrefix: "",
      });
    }
  }, [shop, open]);

  const update = (key, val) => setForm({ ...form, [key]: val });

  const handleSave = () => {
    if (!form.id.trim() || !form.name.trim()) {
      alert("ID and Name are required");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(form.id)) {
      alert("ID must be lowercase letters, numbers, dashes, or underscores");
      return;
    }
    onSave({
      id: form.id.trim().toLowerCase(),
      name: form.name.trim(),
      shortName: form.shortName.trim() || form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      billPrefix: form.billPrefix.trim().toUpperCase() || form.name.slice(0, 2).toUpperCase(),
    });
  };

  const isEditing = !!shop;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? `Edit ${shop.shortName}` : "Add New Shop"} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Shop ID * (unique, lowercase)</label>
          <input
            className="input font-mono"
            value={form.id}
            onChange={(e) => update("id", e.target.value)}
            placeholder="e.g. rozy, warish, main-branch"
            disabled={isEditing}
          />
          {isEditing && (
            <div className="text-xs text-ink-muted mt-1">
              ID cannot be changed after creation
            </div>
          )}
        </div>

        <div>
          <label className="label">Full Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Rozy Sweet, Snacks & Bakery"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Short Name</label>
            <input
              className="input"
              value={form.shortName}
              onChange={(e) => update("shortName", e.target.value)}
              placeholder="e.g. Rozy"
            />
          </div>
          <div>
            <label className="label">Bill Prefix</label>
            <input
              className="input font-mono uppercase"
              value={form.billPrefix}
              onChange={(e) => update("billPrefix", e.target.value.toUpperCase())}
              placeholder="RZ"
              maxLength={3}
            />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Sukhia Pokhri, Darjeeling"
          />
        </div>

        <div>
          <label className="label">Phone</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary">
          <Save size={16} /> {isEditing ? "Save Changes" : "Create Shop"}
        </button>
      </div>
    </Modal>
  );
}