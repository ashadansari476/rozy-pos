import { useState } from "react";
import Modal from "../ui/Modal";
import { Upload, Download, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { parseCSV, csvTemplate } from "../../lib/products";

export default function CSVImport({ open, onClose, onImport }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        setError("CSV appears empty or invalid");
        setParsed(null);
        return;
      }
      if (!rows[0].name) {
        setError("CSV must have a 'name' column in the first row");
        setParsed(null);
        return;
      }
      setParsed(rows);
    } catch (err) {
      setError("Failed to read file: " + err.message);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parsed || !parsed.length) return;
    await onImport(parsed);
    setParsed(null);
    setFileName("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Import Products (CSV)" size="lg">
      {/* Instructions */}
      <div className="bg-accent-light border border-accent/30 rounded-xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink">
            <div className="font-semibold mb-1">CSV Format</div>
            <div className="text-xs text-ink-muted mb-2">
              Columns (in order): <span className="font-mono">name, category, unit, price, stock, lowStock, barcode</span>
            </div>
            <button onClick={downloadTemplate} className="btn-outline py-1.5 px-3 text-xs">
              <Download size={14} /> Download Template
            </button>
          </div>
        </div>
      </div>

      {/* File picker */}
      <div className="mb-5">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
          id="csv-file-input"
        />
        <label
          htmlFor="csv-file-input"
          className="card p-8 flex flex-col items-center justify-center cursor-pointer
                     border-2 border-dashed border-border hover:border-primary transition"
        >
          <Upload size={32} className="text-primary mb-3" />
          <div className="font-semibold text-ink">
            {fileName || "Click to select CSV file"}
          </div>
          <div className="text-xs text-ink-muted mt-1">
            or drag & drop (CSV only)
          </div>
        </label>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 mb-4 flex items-center gap-2 text-danger text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Preview */}
      {parsed && (
        <>
          <div className="flex items-center gap-2 mb-3 text-success">
            <CheckCircle size={18} />
            <span className="font-semibold text-sm">
              {parsed.length} product{parsed.length > 1 ? "s" : ""} ready to import
            </span>
          </div>
          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-bg sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold text-ink-muted">Name</th>
                    <th className="text-left p-2 font-semibold text-ink-muted">Category</th>
                    <th className="text-left p-2 font-semibold text-ink-muted">Unit</th>
                    <th className="text-right p-2 font-semibold text-ink-muted">Price</th>
                    <th className="text-right p-2 font-semibold text-ink-muted">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2 text-ink-muted">{r.category}</td>
                      <td className="p-2 text-ink-muted">{r.unit}</td>
                      <td className="p-2 text-right font-mono">₹{r.price}</td>
                      <td className="p-2 text-right font-mono">{r.stock}</td>
                    </tr>
                  ))}
                  {parsed.length > 20 && (
                    <tr className="border-t border-border">
                      <td colSpan="5" className="p-2 text-center text-ink-muted italic">
                        ...and {parsed.length - 20} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={!parsed || !parsed.length}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileText size={16} /> Import {parsed ? `${parsed.length} Products` : ""}
        </button>
      </div>
    </Modal>
  );
}