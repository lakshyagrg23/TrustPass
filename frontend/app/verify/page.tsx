"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle, XCircle, Clock, Fingerprint,
  TreePine, Award, AlertCircle, ChevronDown, ChevronUp, Loader2, ExternalLink
} from "lucide-react";
import { credentialsApi, type VerificationResult } from "@/lib/api";

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span>{remaining}</span>;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  degree: "Degree",
  graduationYear: "Graduation Year",
  cgpa: "CGPA",
  marks: "Grade / Marks",
  issuerName: "Institution Name",
  issueDate: "Issue Date",
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const shareId = searchParams.get("shareId");

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [error, setError] = useState("");

  const verifyToken = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await credentialsApi.verify(t);
      setResult(data);
    } catch {
      setError("Unable to process this credential. The link may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveAndVerify = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (shareId) {
        // Short URL — fetch the presentation token from the backend by shareId
        const { data } = await import("axios").then(m =>
          m.default.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/credentials/share/${shareId}`)
        );
        await verifyToken(data.data.presentationToken);
      } else if (token) {
        await verifyToken(token);
      }
    } catch {
      setError("Share link not found or has expired.");
      setLoading(false);
    }
  }, [shareId, token, verifyToken]);

  useEffect(() => {
    if (shareId || token) resolveAndVerify();
  }, [shareId, token, resolveAndVerify]);

  if (!token && !shareId && !loading) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "#64748b" }} />
        <h2 className="text-xl font-semibold mb-2" style={{ color: "#f1f5f9" }}>No Credential Token</h2>
        <p className="text-sm" style={{ color: "#64748b" }}>This page requires a valid share link with a credential token.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {loading && (
        <div className="text-center py-20">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: "#6366f1" }} />
          <p className="text-sm" style={{ color: "#64748b" }}>Verifying cryptographic proof...</p>
        </div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
          <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "#ef4444" }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#ef4444" }}>Verification Failed</h2>
          <p className="text-sm" style={{ color: "#64748b" }}>{error}</p>
        </motion.div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Main status card */}
            <div className={`rounded-2xl p-6 ${result.verified ? "glow-success" : "glow-danger"}`} style={{
              background: result.verified
                ? "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05))"
                : "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.05))",
              border: `1px solid ${result.verified ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              <div className="flex items-center gap-4 mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: result.verified ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }}
                >
                  {result.verified
                    ? <CheckCircle className="w-8 h-8" style={{ color: "#10b981" }} />
                    : <XCircle className="w-8 h-8" style={{ color: "#ef4444" }} />}
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: result.verified ? "#10b981" : "#ef4444" }}>
                    {result.verified ? "✅ Credential Verified" : "❌ Verification Failed"}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
                    {result.verified
                      ? "Cryptographic integrity confirmed"
                      : result.failureReason || "This credential could not be verified"}
                  </p>
                </div>
              </div>

              {/* Issuer & dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>Issued By</div>
                  <div className="text-sm font-medium" style={{ color: "#f1f5f9" }}>{result.issuerName}</div>
                </div>
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>Issue Date</div>
                  <div className="text-sm font-medium" style={{ color: "#f1f5f9" }}>
                    {result.issuedAt !== "unknown"
                      ? new Date(result.issuedAt).toLocaleDateString("en-IN")
                      : "Unknown"}
                  </div>
                </div>
              </div>

              {result.verified && (
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "#f59e0b" }}>
                  <Clock className="w-3.5 h-3.5" />
                  <CountdownTimer expiresAt={result.expiresAt} />
                </div>
              )}
            </div>

            {/* Verified Claims */}
            {result.fieldResults.length > 0 && (
              <div className="section-card">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-4 h-4" style={{ color: "#6366f1" }} />
                  <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Verified Claims</span>
                </div>
                <div className="space-y-2">
                  {result.fieldResults.map((fr) => (
                    <motion.div
                      key={fr.field}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between py-3 px-4 rounded-xl"
                      style={{
                        background: fr.merkleProofValid ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                        border: `1px solid ${fr.merkleProofValid ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {fr.merkleProofValid
                          ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
                          : <XCircle className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />}
                        <div>
                          <div className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                            {FIELD_LABELS[fr.field] || fr.field}
                          </div>
                          <div className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
                            {String(fr.value)}
                          </div>
                        </div>
                      </div>
                      <span className={`badge text-xs ${fr.status === "verified" ? "badge-success" : "badge-danger"}`}>
                        {fr.status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Cryptographic checks */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-4">
                <Fingerprint className="w-4 h-4" style={{ color: "#6366f1" }} />
                <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Cryptographic Integrity</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "JWT Signature Valid", ok: result.checks.jwtSignatureValid, desc: "Transport integrity confirmed" },
                  { label: "Not Expired", ok: result.checks.notExpired, desc: "Share link is within validity period" },
                  { label: "Merkle Proofs Valid", ok: result.checks.merkleProofsValid, desc: "All disclosed fields verified against Merkle root" },
                  { label: "Issuer Signature Valid", ok: result.checks.issuerSignatureValid, desc: "Ed25519 signature over Merkle root confirmed" },
                ].map((check) => (
                  <div key={check.label} className="flex items-center gap-3 py-2">
                    {check.ok
                      ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
                      : <XCircle className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />}
                    <div>
                      <div className="text-sm font-medium" style={{ color: check.ok ? "#f1f5f9" : "#ef4444" }}>{check.label}</div>
                      <div className="text-xs" style={{ color: "#64748b" }}>{check.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical details (collapsible) */}
            <div className="section-card">
              <button
                onClick={() => setShowTechDetails(!showTechDetails)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <TreePine className="w-4 h-4" style={{ color: "#06b6d4" }} />
                  <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Technical Details</span>
                </div>
                {showTechDetails ? <ChevronUp className="w-4 h-4" style={{ color: "#64748b" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#64748b" }} />}
              </button>

              <AnimatePresence>
                {showTechDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3">
                      <div className="p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                        <div className="text-xs font-medium mb-1" style={{ color: "#94a3b8" }}>How Selective Disclosure Works</div>
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          Each credential claim is hashed with SHA-256 and arranged in a Merkle tree.
                          The root hash is signed with Ed25519 by the issuer. When sharing, only selected
                          fields are disclosed along with their Merkle proof paths. The verifier recomputes
                          the hashes, validates each proof against the root, and verifies the issuer signature —
                          without ever seeing the hidden fields.
                        </p>
                      </div>

                      {/* Quick Reference */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["Hash Algorithm", "SHA-256"],
                          ["Signature", "Ed25519"],
                          ["Encryption", "AES-256-GCM"],
                          ["Credential ID", result.credentialId.slice(0, 12) + "..."],
                        ].map(([k, v]) => (
                          <div key={k} className="p-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)" }}>
                            <div className="text-xs" style={{ color: "#64748b" }}>{k}</div>
                            <div className="text-xs font-mono font-medium mt-0.5" style={{ color: "#a5f3fc" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="animated-bg min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
      </div>

      {/* Public header */}
      <header className="glass border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold gradient-text">TrustPass</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>Verifier</span>
          </div>
          <a
            href="/"
            className="text-xs flex items-center gap-1"
            style={{ color: "#64748b" }}
          >
            <ExternalLink className="w-3 h-3" />
            Get TrustPass
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#f1f5f9" }}>Credential Verification</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Cryptographic proof powered by Merkle trees and Ed25519 signatures
          </p>
        </div>
        <Suspense fallback={
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "#6366f1" }} />
          </div>
        }>
          <VerifyContent />
        </Suspense>
      </main>
    </div>
  );
}
