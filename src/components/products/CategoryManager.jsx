import { useState } from "react";
import Modal from "../ui/Modal";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

export default function CategoryManager({ open, onClose, categories, onAdd, onUpdate, onRemove }) {
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd({ name: newName.trim(), icon: newIcon });
    setNewName("");
    setNewIcon("📦");
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || "📦");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    await onUpdate(editingId, { name: editName.trim(), icon: editIcon });
    setEditingId(null);
  };

  const icons = ["📦", "🥖", "🍬", "🥨", "☕", "🥤", "🍰", "🍩", "🥐", "🧁", "🍪", "🍫", "🧂", "🥛"];

  return (
    <Modal open={open} onClose={onClose} title="Manage Categories" size="md">
      <div className="bg-bg rounded-xl p-3 mb-4">
        <label className="label">Add New Category</label>
        <div className="flex gap-2">
          <select
            className="input w-20 text-center"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
          >
            {icons.map((ic) => (
              <option key={ic} value={ic}>
                {ic}
              </option>
            ))}
          </select>
          <input
            className="input flex-1"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button onClick={handleAdd} className="btn-primary px-4">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-2 bg-surface border border-border rounded-xl p-3"
          >
            {editingId === cat.id ? (
              <>
                <select
                  className="input w-20 text-center"
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                >
                  {icons.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
                <input
                  className="input flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <button onClick={saveEdit} className="p-2 text-success hover:bg-success/10 rounded-lg">
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-2 text-ink-muted hover:bg-bg rounded-lg"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="text-xl">{cat.icon || "📦"}</span>
                <span className="flex-1 font-medium">{cat.name}</span>
                <button
                  onClick={() => startEdit(cat)}
                  className="p-2 text-ink-muted hover:text-primary hover:bg-primary-light rounded-lg"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${cat.name}"? Products in this category won't be deleted.`))
                      onRemove(cat.id);
                  }}
                  className="p-2 text-danger hover:bg-danger/10 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}