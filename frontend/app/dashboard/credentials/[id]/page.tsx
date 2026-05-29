"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowLeft, Share2, Clock, Award, Fingerprint,
  Link2, Loader2, Copy, Check, ExternalLink, Eye,
  ChevronDown, ChevronUp, QrCode, X, AlertTriangle,
  BarChart3, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { credentialsApi, type CredentialDetail, type ShareRecord, extractError } from "@/lib/api";

// Field label: for user-defined slugified keys, just prettify camelCase
function prettyField(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

// ── Share Detail Modal ─────────────────────────────────────────────────────────
function ShareDetailModal({
  share,
  onClose,
}: {
  share: ShareRecord;
  onClose: () => void;
}) {
  const expired = new Date(share.expiresAt) < new Date();
  const shareUrl = `${window.location.origin}/verify?shareId=${share.id}`;
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Fetch QR on open for active shares
  useEffect(() => {
    if (expired) return;
    setLoadingQr(true);
    // Re-fetch the share token to rebuild QR via backend
    fetch(`${API_BASE}/credentials/share/${share.id}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (data?.data?.presentationToken) {
          // Generate QR client-side using the share URL (not the token — keeps it short)
          const QRCode = (await import("qrcode")).default;
          const url = await QRCode.toDataURL(shareUrl, {
            width: 240,
            margin: 2,
            color: { dark: "#1a1a2e", light: "#ffffff" },
          });
          setQrDataUrl(url);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingQr(false));
  }, [share.id, expired, shareUrl]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeLeft = () => {
    const diff = new Date(share.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-lg glass-strong rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: expired ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)" }}
            >
              <Link2 className="w-4 h-4" style={{ color: expired ? "#ef4444" : "#10b981" }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
                Share Details
              </div>
              <div className="text-xs" style={{ color: expired ? "#ef4444" : "#10b981" }}>
                {expired ? "Expired" : `Active · ${timeLeft()}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <X className="w-4 h-4" style={{ color: "#64748b" }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Disclosed fields */}
          <div>
            <p className="text-xs font-medium mb-2.5" style={{ color: "#94a3b8" }}>
              Disclosed Fields
            </p>
            <div className="flex flex-wrap gap-2">
              {share.disclosedFields.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    color: "#818cf8",
                  }}
                >
                  <Check className="w-3 h-3" />
                  {FIELD_LABELS[f] || f}
                </span>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Views",
                value: String(share.accessCount),
                icon: BarChart3,
                color: "#6366f1",
              },
              {
                label: "Created",
                value: new Date(share.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                }),
                icon: Clock,
                color: "#06b6d4",
              },
              {
                label: "Expires",
                value: new Date(share.expiresAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                }),
                icon: AlertTriangle,
                color: expired ? "#ef4444" : "#f59e0b",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color }} />
                <div className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
                  {value}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* QR + link for active shares */}
          {!expired ? (
            <>
              {/* QR code */}
              <div className="flex justify-center">
                <div className="p-4 rounded-2xl" style={{ background: "white" }}>
                  {loadingQr ? (
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 192, height: 192 }}
                    >
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
                    </div>
                  ) : qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Share QR Code" width={192} height={192} />
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center gap-2"
                      style={{ width: 192, height: 192 }}
                    >
                      <QrCode className="w-10 h-10" style={{ color: "#94a3b8" }} />
                      <span className="text-xs" style={{ color: "#94a3b8" }}>
                        QR unavailable
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Share URL row */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>
                  Share Link
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="input-field text-xs flex-1"
                    style={{ color: "#94a3b8" }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={copyLink}
                    className="btn-primary px-3 py-2 shrink-0"
                    title="Copy link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-2 shrink-0"
                    title="Open verification page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {copied && (
                  <p className="text-xs mt-1.5" style={{ color: "#10b981" }}>
                    ✓ Copied to clipboard
                  </p>
                )}
              </div>
            </>
          ) : (
            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: "#ef4444" }} />
              <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
                This share link has expired
              </p>
              <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                Create a new share to generate a fresh link
              </p>
            </div>
          )}

          {/* Share ID */}
          <div className="pt-1">
            <p className="text-xs" style={{ color: "#475569" }}>
              Share ID:{" "}
              <span className="font-mono" style={{ color: "#64748b" }}>
                {share.id}
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Share History Row ──────────────────────────────────────────────────────────
function ShareRow({
  share,
  index,
  onOpen,
}: {
  share: ShareRecord;
  index: number;
  onOpen: (share: ShareRecord) => void;
}) {
  const expired = new Date(share.expiresAt) < new Date();
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify?shareId=${share.id}`;
  const [copied, setCopied] = useState(false);

  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${expired ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)"}`,
      }}
    >
      {/* Row header */}
      <div className="flex items-center gap-3 p-4">
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: expired ? "#ef4444" : "#10b981",
            boxShadow: expired ? "none" : "0 0 6px rgba(16,185,129,0.6)",
          }}
        />

        {/* Fields */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {share.disclosedFields.map((f) => (
              <span
                key={f}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
              >
                {prettyField(f)}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#475569" }}>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {expired
                ? `Expired ${new Date(share.expiresAt).toLocaleDateString("en-IN")}`
                : `Expires ${new Date(share.expiresAt).toLocaleDateString("en-IN")}`}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {share.accessCount} view{share.accessCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!expired && (
            <button
              onClick={copyLink}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {!expired && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
              title="Open verify page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => onOpen(share)}
            className="p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium px-3"
            style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}
          >
            <QrCode className="w-3.5 h-3.5" />
            Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CredentialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const credentialId = params.id as string;
  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedShare, setSelectedShare] = useState<ShareRecord | null>(null);
  const [showAllShares, setShowAllShares] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCredential = useCallback(async () => {
    try {
      const data = await credentialsApi.get(credentialId);
      setCredential(data);
    } catch (err) {
      toast.error(extractError(err));
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

  const handleDelete = async () => {
    if (!credential) return;
    setDeleting(true);
    try {
      await credentialsApi.delete(credential.id);
      toast.success("Credential deleted");
      router.push("/dashboard");
    } catch (err) {
      toast.error(extractError(err));
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="animated-bg min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
    </div>
  );

  if (!credential) return null;

  const activeShares = credential.shares.filter(s => new Date(s.expiresAt) >= new Date());
  const expiredShares = credential.shares.filter(s => new Date(s.expiresAt) < new Date());
  const visibleShares = showAllShares ? credential.shares : credential.shares.slice(0, 4);

  return (
    <div className="animated-bg min-h-screen">
      {/* Delete confirm modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-sm glass-strong rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Trash2 className="w-6 h-6" style={{ color: "#ef4444" }} />
              </div>
              <h2 className="text-base font-semibold text-center mb-1" style={{ color: "#f1f5f9" }}>Delete Credential?</h2>
              <p className="text-xs text-center font-medium mb-1" style={{ color: "#f1f5f9" }}>{credential.credentialLabel}</p>
              <p className="text-xs text-center mb-5" style={{ color: "#64748b" }}>
                This permanently deletes the credential and all {credential.shares.length} share{credential.shares.length !== 1 ? "s" : ""}. Cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 text-sm rounded-xl font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", color: "white", opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedShare && (
          <ShareDetailModal
            share={selectedShare}
            onClose={() => setSelectedShare(null)}
          />
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-secondary py-2 px-3 text-sm"
              style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}
              title="Delete credential"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Link href="/dashboard" className="btn-secondary py-2 px-3 text-sm">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href={`/dashboard/credentials/${credentialId}/share`} className="btn-primary py-2 px-4 text-sm">
              <Share2 className="w-4 h-4" />
              New Share
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page title — credential label is the identifier, no issuer shown */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <Award className="w-6 h-6" style={{ color: "#6366f1" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>{credential.credentialLabel}</h1>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Issued {new Date(credential.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            &nbsp;·&nbsp;{credential.availableFields.length} fields signed
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: "Total Shares", value: credential.shares.length, color: "#6366f1" },
            { label: "Active", value: activeShares.length, color: "#10b981" },
            { label: "Expired", value: expiredShares.length, color: "#64748b" },
          ].map(({ label, value, color }) => (
            <div key={label} className="section-card text-center py-3">
              <div className="text-xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Claims — left 2/5 */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="section-card">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#f1f5f9" }}>Credential Claims</h2>
              <div className="space-y-2.5">
                {credential.availableFields.map((field, i) => (
                  <motion.div
                    key={field}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div>
                      <div className="text-xs" style={{ color: "#64748b" }}>{prettyField(field)}</div>
                      <div className="text-sm font-semibold mt-0.5" style={{ color: "#f1f5f9" }}>{String(credential.claims[field])}</div>
                    </div>
                    <div className="badge badge-primary text-xs shrink-0 ml-2">
                      <Fingerprint className="w-3 h-3" />Signed
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <Link href={`/dashboard/credentials/${credentialId}/share`} className="btn-primary w-full text-sm">
                  <Share2 className="w-4 h-4" />
                  Selectively Share
                </Link>
              </div>
            </div>

            {/* Crypto info */}
            <div className="section-card">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "#f1f5f9" }}>Cryptographic Info</h2>
              <div className="space-y-2.5 text-xs">
                {[
                  ["Algorithm", "Ed25519 + SHA-256"],
                  ["Merkle Root", credential.merkleRoot.slice(0, 18) + "..."],
                  ["Public Key", credential.issuerPublicKey.slice(0, 18) + "..."],
                  ["Status", "✓ Valid"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span style={{ color: "#64748b" }}>{k}</span>
                    <span
                      className="font-mono text-right"
                      style={{
                        color: k === "Status" ? "#10b981" : "#94a3b8",
                        maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Share History — right 3/5 */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3"
          >
            <div className="section-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4" style={{ color: "#6366f1" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Share History</h2>
                  {credential.shares.length > 0 && (
                    <span className="badge badge-primary text-xs">{credential.shares.length}</span>
                  )}
                </div>
                <Link
                  href={`/dashboard/credentials/${credentialId}/share`}
                  className="text-xs flex items-center gap-1 font-medium"
                  style={{ color: "#6366f1" }}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  New
                </Link>
              </div>

              {credential.shares.length === 0 ? (
                <div className="text-center py-10">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}
                  >
                    <Link2 className="w-7 h-7" style={{ color: "#6366f1" }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: "#f1f5f9" }}>No shares yet</p>
                  <p className="text-xs mb-4" style={{ color: "#64748b" }}>
                    Share this credential selectively — hide what you don&apos;t want to reveal
                  </p>
                  <Link href={`/dashboard/credentials/${credentialId}/share`} className="btn-primary text-sm">
                    <Share2 className="w-4 h-4" />
                    Create First Share
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {visibleShares.map((share, i) => (
                      <ShareRow
                        key={share.id}
                        share={share}
                        index={i}
                        onOpen={setSelectedShare}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Show more / less */}
                  {credential.shares.length > 4 && (
                    <button
                      onClick={() => setShowAllShares(!showAllShares)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#64748b",
                      }}
                    >
                      {showAllShares ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Show {credential.shares.length - 4} More</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
