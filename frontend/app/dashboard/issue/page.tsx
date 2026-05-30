"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowLeft, Sparkles, Eye, Loader2,
  Plus, Trash2, GripVertical, Check, Code2
} from "lucide-react";
import { toast } from "sonner";
import { credentialsApi, extractError } from "@/lib/api";

// ── Slugify field label → camelCase key ───────────────────────────────────────
function slugify(label: string): string {
  const clean = label.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return "field";
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

// ── Quick-start templates (suggestions only, not credential types) ─────────────
interface StarterField {
  label: string;
  type: "text" | "number" | "date";
}
interface Starter {
  id: string;
  name: string;
  fields: StarterField[];
}

const STARTERS: Starter[] = [
  {
    id: "education",
    name: "Education",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Degree", type: "text" },
      { label: "Institution", type: "text" },
      { label: "Graduation Year", type: "number" },
      { label: "CGPA", type: "number" },
    ],
  },
  {
    id: "government",
    name: "Government ID",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Date of Birth", type: "date" },
      { label: "ID Number", type: "text" },
      { label: "Address", type: "text" },
      { label: "Issue Date", type: "date" },
    ],
  },
  {
    id: "employment",
    name: "Employment",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Organization", type: "text" },
      { label: "Role", type: "text" },
      { label: "Employee ID", type: "text" },
      { label: "Start Date", type: "date" },
    ],
  },
];

// ── Draft field model ──────────────────────────────────────────────────────────
interface DraftField {
  id: string;
  label: string;
  type: "text" | "number" | "date";
  value: string;
}

let counter = 0;
const blank = (label = "", type: DraftField["type"] = "text"): DraftField => ({
  id: `f${++counter}`,
  label,
  type,
  value: "",
});

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({
  field,
  onChange,
  onRemove,
  canRemove,
}: {
  field: DraftField;
  onChange: (u: DraftField) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const key = slugify(field.label);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="rounded-xl p-3 group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex gap-2 items-start">
        <div className="mt-3 cursor-grab opacity-25 group-hover:opacity-50 transition-opacity shrink-0">
          <GripVertical className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
        </div>

        <div className="flex-1 grid grid-cols-2 gap-2">
          {/* Label */}
          <div>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              placeholder="Field name"
              className="input-field text-sm"
            />
            {key && field.label.trim() && (
              <p className="text-xs mt-1 font-mono" style={{ color: "#475569" }}>
                <span style={{ color: "#818cf8" }}>{key}</span>
              </p>
            )}
          </div>

          {/* Value + type toggle */}
          <div>
            <div className="flex gap-1 items-center mb-1">
              {(["text", "number", "date"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...field, type: t, value: "" })}
                  className="text-xs px-2 py-0.5 rounded-md transition-all"
                  style={{
                    background: field.type === t ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                    color: field.type === t ? "#818cf8" : "#475569",
                    border: `1px solid ${field.type === t ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={field.value}
              onChange={(e) => onChange({ ...field, value: e.target.value })}
              placeholder={field.type === "date" ? "" : "Value"}
              className="input-field text-sm"
              step={field.type === "number" ? "any" : undefined}
            />
          </div>
        </div>

        <button
          onClick={onRemove}
          disabled={!canRemove}
          className="mt-2 p-1.5 rounded-lg transition-all shrink-0"
          style={{
            color: canRemove ? "#ef4444" : "#1e293b",
            background: canRemove ? "rgba(239,68,68,0.1)" : "transparent",
            cursor: canRemove ? "pointer" : "not-allowed",
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IssuePage() {
  const router = useRouter();
  const [credentialName, setCredentialName] = useState("");
  const [fields, setFields] = useState<DraftField[]>([blank(), blank()]);
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(false);

  const applyStarter = useCallback((starter: Starter) => {
    setFields(starter.fields.map((f) => blank(f.label, f.type)));
  }, []);

  const addField = () => setFields((p) => [...p, blank()]);

  const updateField = (id: string, updated: DraftField) =>
    setFields((p) => p.map((f) => (f.id === id ? updated : f)));

  const removeField = (id: string) =>
    setFields((p) => p.filter((f) => f.id !== id));

  // Build claims — only filled rows, skip invalid numbers
  const claims: Record<string, string | number> = {};
  const invalidNumbers: string[] = [];
  for (const f of fields) {
    if (!f.label.trim() || !f.value.trim()) continue;
    const k = slugify(f.label);
    if (f.type === "number") {
      const n = parseFloat(f.value);
      if (isNaN(n)) { invalidNumbers.push(f.label); continue; }
      claims[k] = n;
    } else {
      claims[k] = f.value;
    }
  }
  const filledCount = Object.keys(claims).length;

  const handleSubmit = async () => {
    if (!credentialName.trim()) {
      toast.error("Give your credential a name");
      return;
    }
    if (invalidNumbers.length > 0) {
      toast.error(`Invalid number value in: ${invalidNumbers.join(", ")}`);
      return;
    }
    if (filledCount < 2) {
      toast.error("Fill in at least 2 fields");
      return;
    }
    setLoading(true);
    try {
      await credentialsApi.issue({
        credentialType: "custom",
        credentialLabel: credentialName.trim(),
        claims,
      });
      toast.success("Credential signed and stored!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animated-bg min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">TrustPass</span>
          </Link>
          <Link href="/dashboard" className="btn-secondary py-2 px-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>Issue Credential</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Every field is independently hashed and signed — you control what to share later
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: builder ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Quick-start strip */}
            <div className="section-card">
              <p className="text-xs font-medium mb-3" style={{ color: "#64748b" }}>
                Quick start — pick a template to pre-fill fields, or build from scratch below
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <motion.button
                    key={s.id}
                    onClick={() => applyStarter(s)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.18)",
                      color: "#a5b4fc",
                    }}
                  >
                    {s.name}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs mt-2.5" style={{ color: "#334155" }}>
                Templates only set the field names — you still fill in the values and can add, rename, or remove any field.
              </p>
            </div>

            {/* Credential name */}
            <div className="section-card">
              <label className="block text-xs font-semibold mb-2" style={{ color: "#94a3b8" }}>
                Credential Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={credentialName}
                onChange={(e) => setCredentialName(e.target.value)}
                placeholder="e.g. Degree Certificate, Driving License, Voter ID…"
                className="input-field"
                maxLength={120}
              />
              <p className="text-xs mt-1.5" style={{ color: "#334155" }}>
                This is the only identifier for your credential — make it descriptive
              </p>
            </div>

            {/* Field builder */}
            <div className="section-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Fields</span>
                  <span
                    className="ml-2 text-xs"
                    style={{ color: filledCount >= 2 ? "#10b981" : "#f59e0b" }}
                  >
                    {filledCount} filled {filledCount < 2 ? "· need at least 2" : "· ready"}
                  </span>
                </div>
                <button
                  onClick={addField}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#818cf8",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Field
                </button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-2 gap-2 mb-2 px-1">
                <span className="text-xs" style={{ color: "#334155" }}>Field name → auto key</span>
                <span className="text-xs" style={{ color: "#334155" }}>Type · Value</span>
              </div>

              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {fields.map((f) => (
                    <FieldRow
                      key={f.id}
                      field={f}
                      onChange={(u) => updateField(f.id, u)}
                      onRemove={() => removeField(f.id)}
                      canRemove={fields.length > 2}
                    />
                  ))}
                </div>
              </AnimatePresence>

              <button
                onClick={addField}
                className="w-full mt-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2"
                style={{
                  background: "transparent",
                  border: "1px dashed rgba(255,255,255,0.1)",
                  color: "#334155",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add another field
              </button>
            </div>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={loading || filledCount < 2 || !credentialName.trim()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="btn-primary w-full py-3.5"
              style={{ opacity: filledCount < 2 || !credentialName.trim() ? 0.45 : 1 }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing & Storing…
                </span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Issue Signed Credential
                </>
              )}
            </motion.button>
          </div>

          {/* ── Right: live preview ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="section-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" style={{ color: "#6366f1" }} />
                  <span className="text-sm font-medium" style={{ color: "#f1f5f9" }}>Preview</span>
                </div>
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="text-xs"
                  style={{ color: "#6366f1" }}
                >
                  {showJson ? "Card" : "JSON"}
                </button>
              </div>

              {showJson ? (
                <pre
                  className="text-xs overflow-auto rounded-lg p-3"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    color: "#a5f3fc",
                    maxHeight: 360,
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify({ credentialLabel: credentialName || "…", claims }, null, 2)}
                </pre>
              ) : (
                <div>
                  <div className="mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-xs mb-0.5" style={{ color: "#475569" }}>Credential name</p>
                    <p className="text-sm font-semibold" style={{ color: credentialName ? "#f1f5f9" : "#334155" }}>
                      {credentialName || "Not set yet"}
                    </p>
                  </div>
                  <AnimatePresence>
                    {Object.entries(claims).map(([k, v]) => (
                      <motion.div
                        key={k}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between py-1.5 px-2.5 rounded-lg mb-1.5"
                        style={{ background: "rgba(99,102,241,0.06)" }}
                      >
                        <span className="text-xs font-mono" style={{ color: "#818cf8" }}>{k}</span>
                        <span className="text-xs font-medium ml-2 truncate" style={{ color: "#f1f5f9", maxWidth: "55%" }}>
                          {String(v)}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filledCount === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: "#334155" }}>
                      Fill the form to see preview
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4" style={{ color: "#06b6d4" }} />
                <span className="text-sm font-medium" style={{ color: "#f1f5f9" }}>How it works</span>
              </div>
              <ul className="space-y-2">
                {[
                  "Field names become camelCase keys automatically",
                  "Each field gets a unique random salt at issuance",
                  "Fields are hashed into a Merkle tree (Ed25519 signed)",
                  "Claims stored encrypted with AES-256-GCM",
                  "Share only selected fields later — with cryptographic proof",
                ].map((item, i) => (
                  <li key={i} className="text-xs flex items-start gap-2" style={{ color: "#475569" }}>
                    <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#06b6d4" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
