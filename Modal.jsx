import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Modal({ open, onClose, title, children, size = "md" }) {
  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#2b1a3a]/35 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-surface/85 backdrop-blur-2xl shadow-warmH w-full ${sizes[size]} max-h-[95vh] sm:max-h-[90vh] flex flex-col
                        rounded-t-xl2 rounded-b-none sm:rounded-xl2`}
            style={{ border: "2px solid var(--edge-line)" }}
          >
            <div
              className="flex items-center justify-between p-5"
              style={{
                borderBottom: "1px solid var(--edge-line)",
                background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-alt) 100%)",
              }}
            >
              <h2 className="font-serif text-xl font-semibold" style={{ color: "#8B1E1E" }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-ink-muted hover:bg-primary-light hover:text-primary transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}