import { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Loader } from "lucide-react";
import { compressImage, blobToDataURL, captureFrame } from "../../lib/imageUtils";

export default function ImageUploader({ value, onChange, productName }) {
  const [preview, setPreview] = useState(value || null);
  const [busy, setBusy] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  // ---------- File upload ----------
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processBlob(await compressImage(file));
  };

  const processBlob = async (blob) => {
    setBusy(true);
    try {
      const dataUrl = await blobToDataURL(blob);
      setPreview(dataUrl);
      onChange({ blob, dataUrl });
    } catch (err) {
      alert("Failed to process image: " + err.message);
    }
    setBusy(false);
  };

  // ---------- Camera ----------
  const openCamera = async () => {
    setCameraError("");
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      setCameraError("Camera access denied. Use Upload instead.");
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capture = async () => {
    if (!videoRef.current) return;
    const blob = await captureFrame(videoRef.current);
    const compressed = await compressImage(
      new File([blob], "capture.jpg", { type: "image/jpeg" })
    );
    closeCamera();
    await processBlob(compressed);
  };

  // ---------- Clear ----------
  const clearImage = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <label className="label">Product Photo</label>

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt={productName || "Product"}
            className="w-40 h-40 object-cover rounded-xl2 border-2 border-border"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-danger text-white
                       flex items-center justify-center shadow-warm"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="w-40 h-40 rounded-xl2 border-2 border-dashed border-border
                        flex flex-col items-center justify-center text-ink-faint bg-bg">
          <Camera size={32} />
          <div className="text-xs mt-1">No image</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="btn-outline text-sm"
        >
          <Upload size={14} /> Upload
        </button>
        <button
          type="button"
          onClick={openCamera}
          disabled={busy}
          className="btn-outline text-sm"
        >
          <Camera size={14} /> Camera
        </button>
        {busy && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader size={14} className="animate-spin" /> Processing...
          </div>
        )}
      </div>

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl2 p-4 max-w-md w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary">Take Photo</h3>
              <button
                onClick={closeCamera}
                className="p-1.5 text-ink-muted hover:bg-primary-light rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            {cameraError ? (
              <div className="text-danger text-sm text-center py-8">{cameraError}</div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-xl2 bg-black aspect-square object-cover"
              />
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={closeCamera} className="btn-outline flex-1">
                Cancel
              </button>
              {!cameraError && (
                <button onClick={capture} className="btn-primary flex-1">
                  <Camera size={14} /> Capture
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}