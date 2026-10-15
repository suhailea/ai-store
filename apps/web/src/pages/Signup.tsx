import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { Loader2 } from "lucide-react";

const inputStyle: React.CSSProperties = {
  height: 38, padding: "0 12px",
  border: "1px solid #8a94a6", borderRadius: 8,
  fontSize: 14, color: "#101828", outline: "none",
  boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
  background: "#fff", width: "100%", boxSizing: "border-box" as const,
};

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
        {label}
        {required && <span style={{ color: "#c0362c", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
      />
    </div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    businessName: "", industry: "", teamSize: 5,
  });

  function set(key: string, val: string | number) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await auth.signup({ ...form });
      setAuth(data.token, data.userId, data.businessId);
      navigate("/hire");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f7f8fa", padding: 24,
      fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px",
        width: "100%", maxWidth: 460,
        boxShadow: "0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)",
        border: "1px solid #e4e7ec",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "#0b2530",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>AI</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#101828", letterSpacing: "-0.01em" }}>
            AI Store
          </span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "#101828", margin: "0 0 6px" }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: "#667085", margin: "0 0 28px", lineHeight: "20px" }}>
          You'll hire your first AI employee right after.
        </p>

        {error && (
          <div style={{
            background: "#fdecea", border: "1px solid #c0362c20", borderRadius: 8,
            padding: "10px 14px", marginBottom: 20,
          }}>
            <span style={{ fontSize: 13, color: "#c0362c" }}>{error}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Your name" value={form.name} onChange={(v) => set("name", v)} required />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
          </div>

          <Field label="Password" type="password" value={form.password} onChange={(v) => set("password", v)} required />

          <div style={{ height: 1, background: "#e4e7ec", margin: "4px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Business name" value={form.businessName} onChange={(v) => set("businessName", v)} required />
            <Field label="Industry" value={form.industry} onChange={(v) => set("industry", v)} placeholder="e.g. Marketing agency" required />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>Team size</label>
            <input
              type="number" min={1} max={1000} value={form.teamSize}
              onChange={(e) => set("teamSize", Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, height: 42, borderRadius: 8, border: "none",
              background: loading ? "#0b4a58" : "#0f5b6c",
              color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.12s",
            }}
          >
            {loading && <Loader2 size={16} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "Creating account…" : "Create account & hire"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#667085" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#0f5b6c", fontWeight: 600, textDecoration: "none" }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
