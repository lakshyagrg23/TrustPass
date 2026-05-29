"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowLeft, Share2, QrCode, Copy, Check,
  Clock, Eye, EyeOff, Fingerprint, AlertCircle, Loader2,
  Camera, UserCheck, X
} from "lucide-react";
import { toast } from "sonner";
import { credentialsApi, type CredentialDetail, type ShareResult, extractError } from "@/lib/api";

const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 Hour" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  degree: "Degree",
  graduationYear: "Graduation Year",
  cgpa: "CGPA",
  marks: "Grade / Marks",
  issuerName: "Institution Name",
  issueDate: "Issue Date",
};

// ── Mock Aadhaar Face Auth Modal ──────────────────────────────────────────────
function AadhaarAuthModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // keeps the live stream so we can always stop it
  const [stage, setStage] = useState<"init" | "scanning" | "detected" | "verified">("init");
  const [countdown, setCountdown] = useState(3);

  // ── Single helper: stop every track and release the indicator light ──────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // ── Always stop camera when the modal unmounts (navigation, close, etc.) ────
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stage transitions ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stage === "scanning") {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          // Simulate face detection after 2 s
          setTimeout(() => setStage("detected"), 2000);
        })
        .catch(() => {
          // Camera unavailable — simulate flow without video
          setTimeout(() => setStage("detected"), 2000);
        });
    }

    if (stage === "detected") {
      let count = 3;
      setCountdown(3);
      const interval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(interval);
          stopCamera(); // stop here so the indicator turns off visibly before "verified"
          setStage("verified");
          setTimeout(onSuccess, 1200);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, onSuccess]);

  // Wrap onClose to ensure camera is stopped before closing
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl p-6 glass-strong"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <Fingerprint className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Aadhaar Authentication</div>
              <div className="text-xs" style={{ color: "#94a3b8" }}>Identity verification required</div>
            </div>
          </div>
          <button onClick={handleClose}><X className="w-5 h-5" style={{ color: "#64748b" }} /></button>
        </div>

        {/* Aadhaar brand strip */}
        <div className="h-1.5 rounded-full mb-5" style={{ background: "linear-gradient(90deg, #f97316, #0284c7, #16a34a)" }} />

        {stage === "init" && (
          <div className="text-center py-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "2px solid rgba(249,115,22,0.3)" }}>
              <Camera className="w-10 h-10" style={{ color: "#f97316" }} />
            </div>
            <p className="text-sm mb-1" style={{ color: "#f1f5f9" }}>Face Authentication</p>
            <p className="text-xs mb-6" style={{ color: "#64748b" }}>Look at the camera to verify your identity before sharing</p>
            <button onClick={() => setStage("scanning")} className="btn-primary w-full" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <Camera className="w-4 h-4" />
              Start Face Scan
            </button>
          </div>
        )}

        {stage === "scanning" && (
          <div className="text-center">
            <div className="relative mx-auto mb-4 rounded-xl overflow-hidden" style={{ width: "100%", height: 200, background: "#000" }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-40 rounded-2xl" style={{ border: "2px solid #f97316", boxShadow: "0 0 20px rgba(249,115,22,0.5)" }}>
                  <div className="w-full h-1 animate-bounce" style={{ background: "linear-gradient(90deg, transparent, #f97316, transparent)" }} />
                </div>
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.7)", color: "#f97316" }}>
                  Scanning face...
                </span>
              </div>
            </div>
            <p className="text-sm" style={{ color: "#94a3b8" }}>Position your face within the frame</p>
          </div>
        )}

        {stage === "detected" && (
          <div className="text-center">
            <div className="relative mx-auto mb-4 rounded-xl overflow-hidden" style={{ width: "100%", height: 200, background: "#000" }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-40 rounded-2xl" style={{ border: "2px solid #10b981", boxShadow: "0 0 20px rgba(16,185,129,0.5)" }} />
              </div>
              <div className="absolute top-3 right-3">
                <div className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: "#10b981", color: "white" }}>
                  MATCHED
                </div>
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.9)", color: "white" }}>
                  Face detected ✓ — Verifying in {countdown}s
                </span>
              </div>
            </div>
            <p className="text-sm" style={{ color: "#10b981" }}>Identity match confirmed</p>
          </div>
        )}

        {stage === "verified" && (
          <div className="text-center py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10b981" }}
            >
              <UserCheck className="w-10 h-10" style={{ color: "#10b981" }} />
            </motion.div>
            <p className="text-base font-semibold" style={{ color: "#10b981" }}>Identity Verified!</p>
            <p className="text-xs mt-1" style={{ color: "#64748b" }}>Proceeding to share generation...</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}


// ── QR Modal ──────────────────────────────────────────────────────────────────
function QRModal({ result, onClose }: { result: ShareResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const expiresAt = new Date(result.expiresAt);

  const copyLink = async () => {
    await navigator.clipboard.writeText(result.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md rounded-2xl p-6 glass-strong"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#f1f5f9" }}>Share Ready!</h2>
            <p className="text-xs" style={{ color: "#64748b" }}>Scan QR or copy the link</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "#64748b" }} /></button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-2xl" style={{ background: "white" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.qrCodeDataUrl} alt="Share QR Code" className="w-48 h-48" />
          </div>
        </div>

        {/* Expiry */}
        <div className="flex items-center justify-center gap-2 mb-4 text-sm" style={{ color: "#f59e0b" }}>
          <Clock className="w-4 h-4" />
          <span>Expires: {expiresAt.toLocaleString()}</span>
        </div>

        {/* Disclosed fields */}
        <div className="section-card mb-4">
          <p className="text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>Disclosed Fields</p>
          <div className="flex flex-wrap gap-1.5">
            {result.disclosedFields.map((f) => (
              <span key={f} className="badge badge-success text-xs">
                <Check className="w-3 h-3" />
                {FIELD_LABELS[f] || f}
              </span>
            ))}
          </div>
        </div>

        {/* Share URL */}
        <div className="flex gap-2">
          <input
            readOnly
            value={result.shareUrl}
            className="input-field text-xs flex-1"
            style={{ color: "#94a3b8" }}
          />
          <button onClick={copyLink} className="btn-primary px-3 py-2 shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {copied && <p className="text-xs text-center mt-2" style={{ color: "#10b981" }}>Copied to clipboard!</p>}

        <p className="text-xs text-center mt-4" style={{ color: "#475569" }}>
          🔒 Hidden fields are cryptographically protected — verifiers cannot see them
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── Main Share Page ───────────────────────────────────────────────────────────
export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const credentialId = params.id as string;

  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [expiresIn, setExpiresIn] = useState("24h");
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [showAadhaar, setShowAadhaar] = useState(false);

  const fetchCredential = useCallback(async () => {
    try {
      const data = await credentialsApi.get(credentialId);
      setCredential(data);
    } catch {
      toast.error("Failed to load credential");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [credentialId, router]);

  useEffect(() => {
    const token = localStorage.getItem("trustpass_token");
    if (!token) { router.push("/login"); return; }
    fetchCredential();
  }, [fetchCredential, router]);

  const toggleField = (field: string) => {
    const next = new Set(selectedFields);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setSelectedFields(next);
  };

  const handleShare = () => {
    if (selectedFields.size === 0) {
      toast.error("Select at least one field to share");
      return;
    }
    // Show Aadhaar auth first
    setShowAadhaar(true);
  };

  const handleAadhaarSuccess = async () => {
    setShowAadhaar(false);
    setSharing(true);
    try {
      const result = await credentialsApi.share(credentialId, Array.from(selectedFields), expiresIn);
      setShareResult(result);
      toast.success("Verifiable Presentation created!");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="animated-bg min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
      </div>
    );
  }

  if (!credential) return null;

  const hiddenFields = credential.availableFields.filter(f => !selectedFields.has(f));

  return (
    <div className="animated-bg min-h-screen">
      <AnimatePresence>
        {showAadhaar && (
          <AadhaarAuthModal
            onSuccess={handleAadhaarSuccess}
            onClose={() => setShowAadhaar(false)}
          />
        )}
        {shareResult && (
          <QRModal result={shareResult} onClose={() => setShareResult(null)} />
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 glass border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">TrustPass</span>
          </div>
          <Link href="/dashboard" className="btn-secondary py-2 px-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Share2 className="w-6 h-6" style={{ color: "#6366f1" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>Selective Disclosure</h1>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Choose exactly which fields to share. Hidden fields are cryptographically protected.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Field selector */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="section-card">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4" style={{ color: "#6366f1" }} />
                <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Select Fields to Disclose</span>
                <span className="badge badge-primary ml-auto">{selectedFields.size} selected</span>
              </div>

              <div className="space-y-2 mb-5">
                {credential.availableFields.map((field) => {
                  const selected = selectedFields.has(field);
                  return (
                    <motion.button
                      key={field}
                      onClick={() => toggleField(field)}
                      whileHover={{ x: 2 }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                      style={{
                        background: selected ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selected ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{
                        background: selected ? "#6366f1" : "transparent",
                        border: `2px solid ${selected ? "#6366f1" : "rgba(255,255,255,0.2)"}`,
                      }}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: "#f1f5f9" }}>
                          {FIELD_LABELS[field] || field}
                        </div>
                        <div className="text-xs truncate" style={{ color: "#64748b" }}>
                          {String(credential.claims[field])}
                        </div>
                      </div>
                      {selected ? (
                        <Eye className="w-4 h-4 shrink-0" style={{ color: "#6366f1" }} />
                      ) : (
                        <EyeOff className="w-4 h-4 shrink-0" style={{ color: "#475569" }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Expiry */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  Share Link Expiry
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiresIn(opt.value)}
                      className="py-2 px-1 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: expiresIn === opt.value ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${expiresIn === opt.value ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: expiresIn === opt.value ? "#818cf8" : "#64748b",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                onClick={handleShare}
                disabled={sharing || selectedFields.size === 0}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="btn-primary w-full"
              >
                {sharing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Presentation...
                  </span>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    Verify & Generate Secure Link
                    <QrCode className="w-4 h-4 ml-auto" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Right: Live preview */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4">

            {/* Verifier sees */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4" style={{ color: "#10b981" }} />
                <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Verifier Will See</span>
                <span className="badge badge-success ml-auto text-xs">Disclosed</span>
              </div>
              {selectedFields.size === 0 ? (
                <div className="py-6 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#475569" }} />
                  <p className="text-xs" style={{ color: "#475569" }}>Select fields to share</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {Array.from(selectedFields).map((field) => (
                      <motion.div
                        key={field}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
                      >
                        <span className="text-xs font-medium" style={{ color: "#10b981" }}>
                          ✓ {FIELD_LABELS[field] || field}
                        </span>
                        <span className="text-xs" style={{ color: "#f1f5f9" }}>
                          {String(credential.claims[field])}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Verifier cannot see */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <EyeOff className="w-4 h-4" style={{ color: "#ef4444" }} />
                <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Cryptographically Hidden</span>
                <span className="badge badge-danger ml-auto text-xs">Protected</span>
              </div>
              {hiddenFields.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#475569" }}>All fields selected — nothing is hidden</p>
              ) : (
                <div className="space-y-2">
                  {hiddenFields.map((field) => (
                    <div key={field} className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)" }}>
                      <span className="text-xs" style={{ color: "#ef4444" }}>🔒 {FIELD_LABELS[field] || field}</span>
                      <span className="text-xs font-mono" style={{ color: "#475569" }}>•••••••</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Crypto proof info */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="w-4 h-4" style={{ color: "#6366f1" }} />
                <span className="text-sm font-medium" style={{ color: "#f1f5f9" }}>Proof Details</span>
              </div>
              <div className="space-y-1.5">
                {[
                  ["Credential ID", credential.id.slice(0, 12) + "..."],
                  ["Issuer", credential.issuerName],
                  ["Merkle Root", credential.merkleRoot.slice(0, 16) + "..."],
                  ["Algorithm", "Ed25519 + SHA-256 Merkle"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: "#64748b" }}>{label}</span>
                    <span className="font-mono" style={{ color: "#94a3b8" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
