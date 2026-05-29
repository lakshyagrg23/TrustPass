"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowLeft, Share2, Clock, Eye, Copy, Check,
  ExternalLink, Loader2, Zap, Archive, LayoutList, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { credentialsApi, type GlobalShareRecord, extractError } from "@/lib/api";

function prettyField(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function expiryLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (date < new Date()) return `Expired ${date.toLocaleDateString("en-IN")}`;
  const diff = date.getTime() - Date.now();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Expires in <1h";
  if (hrs < 24) return `Expires in ${hrs}h`;
  return `Expires ${date.toLocaleDateString("en-IN")}`;
}

// ── Share row ──────────────────────────────────────────────────────────────────
function ShareRow({ share, index }: { share: GlobalShareRecord; index: number }) {
  const expired = new Date(share.expiresAt) < new Date();
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify?shareId=${share.id}`;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${expired ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.12)"}`,
      }}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Status indicator */}
        <div className="mt-1 shrink-0">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: expired ? "#ef4444" : "#10b981",
              boxShadow: expired ? "none" : "0 0 6px rgba(16,185,129,0.5)",
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Credential name link */}
          <Link
            href={`/dashboard/credentials/${share.credentialId}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold mb-2 hover:underline"
            style={{ color: "#f1f5f9" }}
          >
            {share.credentialLabel}
            <ChevronRight className="w-3 h-3" style={{ color: "#475569" }} />
          </Link>

          {/* Disclosed fields */}
          <div className="flex flex-wrap gap-1.5 mb-2">
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

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#475569" }}>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {expiryLabel(share.expiresAt)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {share.accessCount} view{share.accessCount !== 1 ? "s" : ""}
            </span>
            <span>{timeAgo(share.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        {!expired && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyLink}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
              title="Open verify page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "all" | "active" | "expired";

export default function SharesPage() {
  const router = useRouter();
  const [shares, setShares] = useState<GlobalShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await credentialsApi.getAllShares();
      setShares(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("trustpass_token");
    if (!token) { router.push("/login"); return; }
    fetchShares();
  }, [router, fetchShares]);

  const now = new Date();
  const active = shares.filter((s) => new Date(s.expiresAt) >= now);
  const expired = shares.filter((s) => new Date(s.expiresAt) < now);
  const visible = tab === "active" ? active : tab === "expired" ? expired : shares;

  const TABS: { id: Tab; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { id: "all", label: "All", count: shares.length, icon: <LayoutList className="w-4 h-4" />, color: "#6366f1" },
    { id: "active", label: "Active", count: active.length, icon: <Zap className="w-4 h-4" />, color: "#10b981" },
    { id: "expired", label: "Expired", count: expired.length, icon: <Archive className="w-4 h-4" />, color: "#64748b" },
  ];

  return (
    <div className="animated-bg min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">TrustPass</span>
          </div>
          <Link href="/dashboard" className="btn-secondary py-2 px-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <div className="flex items-center gap-3 mb-1">
            <Share2 className="w-6 h-6" style={{ color: "#06b6d4" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>Shared Credentials</h1>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            All selective disclosure shares across your credentials
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-3 gap-4 mb-6"
        >
          {[
            { label: "Total Shares", value: shares.length, color: "#6366f1" },
            { label: "Active", value: active.length, color: "#10b981" },
            { label: "Total Views", value: shares.reduce((a, s) => a + s.accessCount, 0), color: "#06b6d4" },
          ].map(({ label, value, color }) => (
            <div key={label} className="section-card text-center py-4">
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-5 p-1 rounded-xl w-fit"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {TABS.map(({ id, label, count, icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === id ? "rgba(99,102,241,0.15)" : "transparent",
                color: tab === id ? color : "#64748b",
                border: tab === id ? `1px solid rgba(99,102,241,0.2)` : "1px solid transparent",
              }}
            >
              <span style={{ color: tab === id ? color : "#475569" }}>{icon}</span>
              {label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                style={{
                  background: tab === id ? `rgba(99,102,241,0.2)` : "rgba(255,255,255,0.06)",
                  color: tab === id ? color : "#475569",
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </motion.div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
          </div>
        ) : visible.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <Share2 className="w-8 h-8" style={{ color: "#6366f1" }} />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: "#f1f5f9" }}>
              {tab === "all" ? "No shares yet" : tab === "active" ? "No active shares" : "No expired shares"}
            </p>
            <p className="text-sm mb-5" style={{ color: "#64748b" }}>
              {tab === "all"
                ? "Go to a credential and create a selective disclosure share"
                : "Switch to another tab to view other shares"}
            </p>
            {tab === "all" && (
              <Link href="/dashboard" className="btn-primary inline-flex">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-2.5">
              {visible.map((share, i) => (
                <ShareRow key={share.id} share={share} index={i} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
