"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authApi, extractError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await authApi.login(form.email, form.password);
      localStorage.setItem("trustpass_token", token);
      localStorage.setItem("trustpass_user", JSON.stringify(user));
      toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animated-bg min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 pulse-glow" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">TrustPass</h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Verifiable Credentials Platform</p>
        </div>

        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: "#f1f5f9" }}>Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: "#64748b" }}>Sign in to your credential wallet</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#64748b" }} />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#64748b" }} />
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-10 pr-10"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "#64748b" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium" style={{ color: "#818cf8" }}>
              Create one
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 mt-6">
          {["Ed25519 Signed", "Merkle Proof", "AES-256 Encrypted"].map((label) => (
            <span key={label} className="text-xs flex items-center gap-1" style={{ color: "#475569" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#6366f1" }} />
              {label}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
