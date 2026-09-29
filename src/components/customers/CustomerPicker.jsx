import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { searchCustomers, addCustomer, findCustomerByPhone } from "../../lib/customers";
import { User, Phone, Plus, Search } from "lucide-react";

export default function CustomerPicker({ open, onClose, onSelect }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  // New customer form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setShowAdd(false);
      setName("");
      setPhone("");
      setAddress("");
    }
  }, [open]);

  useEffect(() => {
    (async () => {
      const r = await searchCustomers(search);
      setResults(r.slice(0, 20));
    })();
  }, [search]);

  const handleAdd = async () => {
    if (!name.trim()) return alert("Name required");
    const id = await addCustomer({ name, phone, address });
    const newCustomer = { id, name, phone, address };
    onSelect(newCustomer);
    onClose();
  };

  const handleQuickAdd = async () => {
    // Auto-fill phone if search looks like a number
    if (/^\d+$/.test(search) && search.length >= 6) {
      setPhone(search);
    }
    setShowAdd(true);
  };

  return (
    <Modal open={open} onClose={onClose} title="Select Customer" size="md">
      {!showAdd ? (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              className="input pl-9"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <button onClick={handleQuickAdd} className="btn-outline w-full mb-4">
            <Plus size={16} /> Add New Customer
          </button>

          {/* Results */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="text-center py-8 text-ink-muted text-sm">
                {search ? "No customers found" : "Start typing to search"}
              </div>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); onClose(); }}
                  className="w-full text-left bg-bg rounded-xl p-3 hover:bg-primary-light transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                      <User size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      {c.phone && (
                        <div className="text-xs text-ink-muted flex items-center gap-1">
                          <Phone size={11} /> {c.phone}
                        </div>
                      )}
                    </div>
                    {c.totalSpent > 0 && (
                      <div className="text-xs text-ink-muted text-right">
                        ₹{c.totalSpent.toFixed(0)}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Add form */}
          <div className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                type="tel"
              />
            </div>
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={() => setShowAdd(false)} className="btn-outline flex-1">
              Back
            </button>
            <button onClick={handleAdd} className="btn-primary flex-1">
              Save Customer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}