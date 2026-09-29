import { useEffect, useState } from "react";
import { useCustomers } from "../stores/customerStore";
import { useProducts } from "../stores/productStore";
import { useApp } from "../stores/appStore";
import {
  getAllOrders, getOrderStats, updateOrderStatus,
  deleteOrder, recordOrderPayment, completeOrder,
} from "../lib/customers";
import OrderModal from "../components/orders/OrderModal";
import Modal from "../components/ui/Modal";
import {
  ClipboardList, Plus, Search, Clock, CheckCircle,
  AlertTriangle, Calendar, User, Phone, Trash2,
} from "lucide-react";
import SearchInput from "../components/ui/SearchInput";
import { printOrder } from "../lib/orderPrint";

const STATUS_META = {
  pending: { label: "Pending", color: "warning", icon: Clock },
  ready: { label: "Ready", color: "accent", icon: AlertTriangle },
  delivered: { label: "Delivered", color: "success", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "danger", icon: AlertTriangle },
};

export default function Orders() {
  const user = useApp((s) => s.user);
  const { products, load: loadProducts } = useProducts();
  const { loadOrders } = useCustomers();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [delivering, setDelivering] = useState(null);

  useEffect(() => {
    (async () => {
      loadProducts();
      const [o, s] = await Promise.all([getAllOrders({}), getOrderStats()]);
      setOrders(o);
      setStats(s);
    })();
  }, [refresh]);

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.orderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q)
      );
    }
    return true;
  });

  const handleDelete = async (o) => {
    if (!confirm(`Delete order ${o.orderNo}?`)) return;
    await deleteOrder(o.id);
    setRefresh((r) => r + 1);
  };

  const handleStatusChange = async (orderId, status) => {
    if (status === "delivered") {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setDelivering(order);
        return;
      }
    }
    await updateOrderStatus(orderId, status, user.username);
    setRefresh((r) => r + 1);
  };

  const handleDeliveryComplete = async ({ orderId, paymentAmount, paymentMode, counter }) => {
    try {
      const result = await completeOrder({
        orderId,
        paymentAmount,
        paymentMode,
        counter,
        user: user.username,
      });
      setDelivering(null);
      setRefresh((r) => r + 1);
      alert(`✅ Order delivered\nBill: ${result.billNo}${result.change > 0 ? `\nChange: ₹${result.change.toFixed(2)}` : ""}`);
    } catch (e) {
      alert("Failed: " + e.message);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface">
               <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl text-primary font-semibold flex items-center gap-2">
              <ClipboardList size={20} className="sm:w-6 sm:h-6" /> Advance Orders
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {stats?.total || 0} total · {stats?.pending || 0} pending · {stats?.today || 0} today
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="btn-primary text-xs sm:text-sm py-2 px-3"
          >
            <Plus size={14} /> New Order
          </button>
        </div> 

        {/* Stats cards */}
        {stats && (
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-4">
            <StatMini icon={<Clock size={14} />} label="Pending" value={stats.pending} />
            <StatMini icon={<AlertTriangle size={14} />} label="Ready" value={stats.ready} />
            <StatMini icon={<Calendar size={14} />} label="Due Today" value={stats.today} />
            <StatMini
              icon={<AlertTriangle size={14} />}
              label="Overdue"
              value={stats.overdue}
              warn={stats.overdue > 0}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "ready", "delivered"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                filter === f
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg text-ink hover:bg-primary-light"
              }`}
            >
              {f}
            </button>
          ))}
                    <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by order no, name, phone..."
            className="flex-1 min-w-[200px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto mt-8">
            <ClipboardList size={48} className="mx-auto text-ink-faint mb-4" />
            <h2 className="font-serif text-xl text-primary font-semibold mb-2">
              {orders.length === 0 ? "No orders yet" : "No matches"}
            </h2>
            <p className="text-ink-muted text-sm mb-5">
              {orders.length === 0
                ? "Record advance orders for custom cakes, festival boxes, and bulk bookings."
                : "Try a different filter."}
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                <Plus size={16} /> New Order
              </button>
            )}
          </div>
        ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {filtered.map((o) => {
              const meta = STATUS_META[o.status] || STATUS_META.pending;
              const Icon = meta.icon;
              const overdue = o.status === "pending" && o.deliveryDate < Date.now();
              return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-${meta.color}/10 text-${meta.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-sm">{o.orderNo}</div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg bg-${meta.color}/10 text-${meta.color} capitalize`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User size={12} className="text-ink-muted" />
                      <span className="font-semibold">{o.customerName}</span>
                    </div>
                    {o.customerPhone && (
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <Phone size={11} /> {o.customerPhone}
                      </div>
                    )}
                    <div className={`flex items-center gap-2 text-xs ${overdue ? "text-danger font-semibold" : "text-ink-muted"}`}>
                      <Calendar size={11} />
                      Due {new Date(o.deliveryDate).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short",
                      })}
                      {overdue && " (OVERDUE)"}
                    </div>
                  </div>

                  <div className="bg-bg rounded-xl p-2 mb-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Items</span>
                      <span className="font-mono">{o.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Total</span>
                      <span className="font-mono font-semibold text-primary">
                        ₹{o.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    {o.advanceAmount > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Advance</span>
                          <span className="font-mono text-success">
                            ₹{o.advanceAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Balance</span>
                          <span className="font-mono text-warning font-semibold">
                            ₹{o.balanceAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                                    <div className="flex gap-1">
                    {o.status === "pending" && (
                      <button
                        onClick={() => handleStatusChange(o.id, "ready")}
                        className="btn-primary flex-1 py-1.5 text-xs"
                      >
                        Mark Ready
                      </button>
                    )}
                    {o.status === "ready" && (
                      <button
                        onClick={() => handleStatusChange(o.id, "delivered")}
                        className="btn-primary flex-1 py-1.5 text-xs"
                      >
                        Mark Delivered
                      </button>
                    )}
                    <button
                      onClick={() => printOrder(o, "58")}
                      className="btn-outline py-1.5 px-2 text-xs"
                      title="Print 58mm"
                    >
                      🖨️
                    </button>
                    <button
                      onClick={() => setViewing(o)}
                      className="btn-outline py-1.5 px-2 text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(o)}
                      className="btn-outline py-1.5 px-2 text-xs text-danger hover:border-danger"
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

      <OrderModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        products={products}
        editingOrder={editing}
        onSaved={() => setRefresh((r) => r + 1)}
      />

      {viewing && (
        <OrderDetail
          order={viewing}
          onClose={() => setViewing(null)}
          onStatusChange={async (s) => {
            if (s === "delivered") {
              setViewing(null);
              setDelivering(viewing);
              return;
            }
            await handleStatusChange(viewing.id, s);
            setViewing(null);
          }}
        />
      )}

      {delivering && (
        <DeliveryPaymentModal
          order={delivering}
          onClose={() => setDelivering(null)}
          onConfirm={handleDeliveryComplete}
        />
      )}
    </div>
  );
}

function StatMini({ icon, label, value, warn }) {
  return (
    <div className="card p-2 sm:p-3">
      <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
        warn ? "text-warning" : "text-ink-muted"
      }`}>
        {icon} <span className="hidden sm:inline">{label}</span>
      </div>
      <div className={`font-mono text-base sm:text-lg font-bold mt-1 ${warn ? "text-warning" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function DeliveryPaymentModal({ order, onClose, onConfirm }) {
  const balance = order.balanceAmount || 0;
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [counter, setCounter] = useState("Rozy");
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const change = Math.max(0, amountNum - balance);
  const remaining = Math.max(0, balance - amountNum);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm({
      orderId: order.id,
      paymentAmount: amountNum,
      paymentMode,
      counter,
    });
    setSaving(false);
  };

  return (
    <Modal open={true} onClose={onClose} title={`Deliver Order ${order.orderNo}`} size="md">
      <div className="bg-bg rounded-xl p-3 mb-4">
        <div className="font-semibold">{order.customerName}</div>
        {order.customerPhone && (
          <div className="text-xs text-ink-muted">{order.customerPhone}</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-bg rounded-xl p-3 text-center">
          <div className="text-xs text-ink-muted uppercase">Total</div>
          <div className="font-mono text-lg font-bold text-primary mt-1">
            ₹{order.totalAmount.toFixed(2)}
          </div>
        </div>
        <div className="bg-success/10 rounded-xl p-3 text-center">
          <div className="text-xs text-ink-muted uppercase">Advance</div>
          <div className="font-mono text-lg font-bold text-success mt-1">
            ₹{(order.advanceAmount || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-warning/10 rounded-xl p-3 text-center">
          <div className="text-xs text-ink-muted uppercase">Balance Due</div>
          <div className="font-mono text-lg font-bold text-warning mt-1">
            ₹{balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Payment Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {["Cash", "UPI", "Card"].map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMode(m)}
              className={`py-2.5 rounded-xl font-semibold text-sm transition ${
                paymentMode === m
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg text-ink hover:bg-primary-light"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Amount Received (₹)</label>
        <input
          type="number"
          step="0.01"
          className="input font-mono text-2xl text-center"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mb-4">
        <label className="label">Counter (for bill number)</label>
        <div className="grid grid-cols-2 gap-2">
          {["Rozy", "Warish"].map((c) => (
            <button
              key={c}
              onClick={() => setCounter(c)}
              className={`py-2.5 rounded-xl font-semibold text-sm transition ${
                counter === c
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg text-ink hover:bg-primary-light"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {amountNum > 0 && (
        <div className={`rounded-xl p-4 text-center mb-4 ${
          change > 0 ? "bg-success/10" : remaining > 0 ? "bg-warning/10" : "bg-success/10"
        }`}>
          <div className="text-xs text-ink-muted uppercase">
            {change > 0 ? "Change to Return" : remaining > 0 ? "Remaining" : "Fully Paid ✅"}
          </div>
          <div className={`font-mono text-2xl font-bold mt-1 ${
            change > 0 || remaining === 0 ? "text-success" : "text-warning"
          }`}>
            ₹{(change > 0 ? change : remaining).toFixed(2)}
          </div>
        </div>
      )}

      <div className="bg-accent-light rounded-xl p-3 mb-4 text-xs text-ink-muted">
        <b>On confirm:</b> Stock will deduct, a bill will be generated, and this order will
        appear in Dashboard & Reports.
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline flex-1">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving || remaining > 0}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? "Processing..." : "Complete & Bill"}
        </button>
      </div>
    </Modal>
  );
}

function OrderDetail({ order, onClose, onStatusChange }) {
  return (
    <Modal open={true} onClose={onClose} title={`Order ${order.orderNo}`} size="md">
      <div className="space-y-4">
        <div className="bg-bg rounded-xl p-3">
          <div className="font-semibold">{order.customerName}</div>
          {order.customerPhone && (
            <div className="text-xs text-ink-muted">{order.customerPhone}</div>
          )}
        </div>

        {order.notes && (
          <div className="bg-accent-light rounded-xl p-3">
            <div className="text-xs text-ink-muted uppercase font-semibold mb-1">Notes</div>
            <div className="text-sm">{order.notes}</div>
          </div>
        )}

        <div>
          <div className="text-xs text-ink-muted uppercase font-semibold mb-2">Items</div>
          <div className="space-y-1">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm bg-bg rounded-lg p-2">
                <span>{it.productName} × {it.qty}</span>
                <span className="font-mono">₹{it.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-accent-light rounded-xl p-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Total</span>
            <span className="font-mono font-bold">₹{order.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>Advance paid</span>
            <span className="font-mono text-success">₹{order.advanceAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Balance</span>
            <span className="font-mono text-warning">₹{order.balanceAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border flex-wrap">
          <button
            onClick={() => printOrder(order, "58")}
            className="btn-outline flex-1"
          >
            🖨️ 58mm
          </button>
          <button
            onClick={() => printOrder(order, "80")}
            className="btn-outline flex-1"
          >
            🖨️ 80mm
          </button>
          <button
            onClick={() => printOrder(order, "a4")}
            className="btn-outline flex-1"
          >
            📄 A4
          </button>
        </div>
        <div className="flex gap-2">
          {order.status !== "delivered" && (
            <button
              onClick={() => onStatusChange("delivered")}
              className="btn-primary flex-1"
            >
              Mark Delivered
            </button>
          )}
          {order.status === "pending" && (
            <button
              onClick={() => onStatusChange("ready")}
              className="btn-outline flex-1"
            >
              Mark Ready
            </button>
          )}
          <button onClick={onClose} className="btn-outline">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}