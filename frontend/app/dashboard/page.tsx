"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, LogOut, Award, Share2, Eye,
  Fingerprint, Clock, BookOpen, ChevronRight, Loader2, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { credentialsApi, type Credential, extractError } from "@/lib/api";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
  "linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #0e7490 100%)",
  "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #064e3b 100%)",
  "linear-gradient(135deg, #4a044e 0%, #701a75 50%, #4a044e 100%)",
  "linear-gradient(135deg, #881337 0%, #9f1239 50%, #881337 100%)",
  "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #1c1917 100%)",
];

// ── Delete confirmation modal ──────────────────────────────────────────────────
function DeleteConfirmModal({
  credential,
  onConfirm,
  onCancel,
  loading,
}: {
  credential: Credential;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm glass-strong rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <Trash2 className="w-6 h-6" style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-base font-semibold text-center mb-1" style={{ color: "#f1f5f9" }}>
          Delete Credential?
        </h2>
        <p className="text-xs text-center mb-1" style={{ color: "#94a3b8" }}>
          <span className="font-semibold" style={{ color: "#f1f5f9" }}>{credential.credentialLabel}</span>
        </p>
        <p className="text-xs text-center mb-5" style={{ color: "#64748b" }}>
          This will permanently delete the credential and all {credential.shareCount} share
          {credential.shareCount !== 1 ? "s" : ""} associated with it. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-sm rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "white", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Credential card ────────────────────────────────────────────────────────────
function CredentialCard({
  credential,
  index,
  onShare,
  onDelete,
}: {
  credential: Credential;
  index: number;
  onShare: (id: string) => void;
  onDelete: (credential: Credential) => void;
}) {
  const router = useRouter();
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const issuedDate = new Date(credential.issuedAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      onClick={() => router.push(`/dashboard/credentials/${credential.id}`)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: gradient, minHeight: 200 }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/dashboard/credentials/${credential.id}`)}
    >
      {/* Shimmer hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 shimmer" />

      <div className="relative p-5 flex flex-col h-full" style={{ minHeight: 200 }}>
        {/* Top row: Signed badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="badge" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <Fingerprint className="w-3 h-3" />
            Signed
          </div>
          {/* Delete button — stops propagation so card click doesn't fire */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(credential); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}
            title="Delete credential"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Credential label — the primary identifier */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white leading-snug mb-2.5">
            {credential.credentialLabel}
          </h3>
          {/* Field pills */}
          <div className="flex flex-wrap gap-1.5">
            {credential.availableFields.slice(0, 4).map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
              >
                {field}
              </span>
            ))}
            {credential.availableFields.length > 4 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
              >
                +{credential.availableFields.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.45)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{issuedDate}</span>
            {credential.shareCount > 0 && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                · {credential.shareCount} share{credential.shareCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onShare(credential.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const data = await credentialsApi.list();
      setCredentials(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("trustpass_token");
    if (!token) { router.push("/login"); return; }
    const stored = localStorage.getItem("trustpass_user");
    if (stored) setUser(JSON.parse(stored));
    fetchCredentials();
  }, [router, fetchCredentials]);

  const handleLogout = () => {
    localStorage.removeItem("trustpass_token");
    localStorage.removeItem("trustpass_user");
    router.push("/login");
  };

  const handleShare = (credentialId: string) => {
    router.push(`/dashboard/credentials/${credentialId}/share`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await credentialsApi.delete(deleteTarget.id);
      toast.success("Credential deleted");
      setCredentials((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animated-bg min-h-screen">
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmModal
            credential={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      {/* Fixed background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">TrustPass</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm hidden sm:block" style={{ color: "#64748b" }}>{user.name}</span>
            )}
            <Link href="/dashboard/shares" className="btn-secondary py-2 px-3 text-sm hidden sm:flex">
              <Share2 className="w-4 h-4" />
              Shares
            </Link>
            <Link href="/dashboard/issue" className="btn-primary py-2 px-4 text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Credential</span>
            </Link>
            <button onClick={handleLogout} className="btn-secondary py-2 px-3">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#f1f5f9" }}>
            My Credentials
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Issue, manage, and selectively share your verifiable credentials
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {[
            { label: "Credentials", value: credentials.length, icon: Award, color: "#6366f1" },
            { label: "Total Shares", value: credentials.reduce((a, c) => a + c.shareCount, 0), icon: Share2, color: "#06b6d4" },
            { label: "Fields Signed", value: credentials.reduce((a, c) => a + c.availableFields.length, 0), icon: Fingerprint, color: "#10b981" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="section-card text-center py-4">
              <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
              <div className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
          </div>
        ) : credentials.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <BookOpen className="w-10 h-10" style={{ color: "#6366f1" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#f1f5f9" }}>No credentials yet</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>
              Issue your first verifiable credential to get started
            </p>
            <Link href="/dashboard/issue" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Issue First Credential
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {credentials.map((cred, i) => (
                <CredentialCard
                  key={cred.id}
                  credential={cred}
                  index={i}
                  onShare={handleShare}
                  onDelete={setDeleteTarget}
                />
              ))}
            </AnimatePresence>

            {/* Add new card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: credentials.length * 0.07 }}
            >
              <Link
                href="/dashboard/issue"
                className="flex flex-col items-center justify-center h-full rounded-2xl transition-all duration-300 group"
                style={{ minHeight: 200, border: "2px dashed rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.03)" }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform" style={{ background: "rgba(99,102,241,0.1)" }}>
                  <Plus className="w-6 h-6" style={{ color: "#6366f1" }} />
                </div>
                <span className="text-sm font-medium" style={{ color: "#6366f1" }}>New Credential</span>
                <ChevronRight className="w-4 h-4 mt-1 group-hover:translate-x-1 transition-transform" style={{ color: "#4f46e5" }} />
              </Link>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
