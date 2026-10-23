import { useEffect, useState } from "react";
import { useCustomers } from "../stores/customerStore";
import { getCustomerStats, getCustomerHistory } from "../lib/customers";
import Modal from "../components/ui/Modal";
import {
  Users, Plus, Phone, MapPin, Award,
  ShoppingCart, Edit2, Trash2, History,
} from "lucide-react";
import SearchInput from "../components/ui/SearchInput";

export default function Customers() {
  const { customers, loading, loadCustomers, addCustomer, updateCustomer, removeCustomer } = useCustomers();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  const handleSave = async () => {
    const name = document.getElementById("custName").value.trim();
    const phone = document.getElementById("custPhone").value.trim();
    const address = document.getElementById("custAddress").value.trim();
    const notes = document.getElementById("custNotes").value.trim();
    const birthday = document.getElementById("custBirthday").value;

    if (!name) return alert("Name required");

    if (editing) {
      await updateCustomer(editing.id, { name, phone, address, notes, birthday });
    } else {
      await addCustomer({ name, phone, address, notes, birthday });
    }
    setShowAdd(false);
    setEditing(null);
  };

  const openEdit = (c) => { setEditing(c); setShowAdd(true); };
  const openAdd = () => { setEditing(null); setShowAdd(true); };

  const handleDelete = async (c) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await removeCustomer(c.id);
    } catch (error) {
      alert(error?.message || "Could not delete this customer.");
    }
  };

  const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface/70">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl text-primary font-semibold flex items-center gap-2">
              <Users size={20} className="sm:w-6 sm:h-6" /> Customers
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {customers.length} customers · ₹{totalSpent.toFixed(0)} lifetime
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary text-xs sm:text-sm py-2 px-3">
            <Plus size={14} /> Add
          </button>
        </div>

                <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or phone..."
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 text-ink-muted">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto mt-8">
            <Users size={48} className="mx-auto text-ink-faint mb-4" />
            <h2 className="font-serif text-xl text-primary font-semibold mb-2">
              {customers.length === 0 ? "No customers yet" : "No matches"}
            </h2>
            <p className="text-ink-muted text-sm mb-5">
              {customers.length === 0
                ? "Add your first customer to track their purchases and offer personalized service."
                : "Try a different search."}
            </p>
            {customers.length === 0 && (
              <button onClick={openAdd} className="btn-primary">
                <Plus size={16} /> Add Customer
              </button>
            )}
          </div>
        ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{c.name}</div>
                    {c.phone && (
                      <div className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {c.phone}
                      </div>
                    )}
                  </div>
                </div>

                {c.totalSpent > 0 && (
                  <div className="bg-bg/45 rounded-xl p-2 mb-3 flex justify-between">
                    <div className="text-xs text-ink-muted">Lifetime</div>
                    <div className="font-mono font-semibold text-primary text-sm">
                      ₹{c.totalSpent.toFixed(0)}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setViewing(c)}
                    className="btn-outline flex-1 py-1.5 text-xs"
                  >
                    <History size={12} /> View
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="btn-outline py-1.5 px-2 text-xs"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="btn-outline py-1.5 px-2 text-xs text-danger hover:border-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        title={editing ? "Edit Customer" : "Add Customer"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              id="custName"
              className="input"
              defaultValue={editing?.name || ""}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              id="custPhone"
              className="input"
              type="tel"
              defaultValue={editing?.phone || ""}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              id="custAddress"
              className="input"
              defaultValue={editing?.address || ""}
            />
          </div>
          <div>
            <label className="label">Birthday (for reminders)</label>
            <input
              id="custBirthday"
              type="date"
              className="input"
              defaultValue={editing?.birthday || ""}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              id="custNotes"
              className="input"
              rows="2"
              defaultValue={editing?.notes || ""}
              placeholder="e.g. prefers dark sweets"
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
            {editing ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </Modal>

      {viewing && (
        <CustomerDetail customer={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onClose }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await getCustomerStats(customer.id);
      const h = await getCustomerHistory(customer.id);
      setStats(s);
      setHistory(h.slice(0, 20));
    })();
  }, [customer.id]);

  return (
    <Modal open={true} onClose={onClose} title={customer.name} size="md">
      <div className="space-y-4">
        {/* Contact */}
        <div className="bg-bg/45 rounded-xl p-3 space-y-1">
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-ink-muted" /> {customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-ink-muted" /> {customer.address}
            </div>
          )}
          {customer.notes && (
            <div className="text-xs text-ink-muted italic mt-1">
              "{customer.notes}"
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="card p-3 text-center">
                <div className="text-xs text-ink-muted uppercase">Spent</div>
                <div className="font-mono text-lg font-bold text-primary mt-1">
                  ₹{stats.totalSpent.toFixed(0)}
                </div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xs text-ink-muted uppercase">Bills</div>
                <div className="font-mono text-lg font-bold mt-1">
                  {stats.totalBills}
                </div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xs text-ink-muted uppercase">Avg Bill</div>
                <div className="font-mono text-lg font-bold mt-1">
                  ₹{stats.avgBill.toFixed(0)}
                </div>
              </div>
            </div>

            {stats.favorites.length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Award size={14} className="text-accent" /> Favorites
                </h3>
                <div className="space-y-1">
                  {stats.favorites.map((f) => (
                    <div key={f.name} className="flex justify-between text-sm">
                      <span>{f.name}</span>
                      <span className="font-mono text-ink-muted">
                        {f.qty} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <ShoppingCart size={14} className="text-primary" /> Recent Purchases
              </h3>
              {history.length === 0 ? (
                <div className="text-center py-4 text-ink-faint text-xs">
                  No purchases yet
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((s) => (
                    <div key={s.id} className="bg-bg/45 rounded-lg p-2 flex justify-between text-xs">
                      <div>
                        <div className="font-mono font-semibold">{s.billNo}</div>
                        <div className="text-ink-muted">
                          {new Date(s.ts).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-primary">
                        ₹{s.total.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}