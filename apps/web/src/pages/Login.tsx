import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      setAuth(data.token, data.userId, data.businessId);
      navigate("/office");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
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
        width: "100%", maxWidth: 420,
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
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: "#667085", margin: "0 0 28px", lineHeight: "20px" }}>
          Sign in to your workspace
        </p>

        {error && (
          <div style={{
            background: "#fdecea", border: "1px solid #c0362c20", borderRadius: 8,
            padding: "10px 14px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 13, color: "#c0362c", lineHeight: "18px" }}>{error}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              style={{
                height: 38, padding: "0 12px",
                border: "1px solid #8a94a6", borderRadius: 8,
                fontSize: 14, color: "#101828", outline: "none",
                boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
                background: "#fff",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{
                height: 38, padding: "0 12px",
                border: "1px solid #8a94a6", borderRadius: 8,
                fontSize: 14, color: "#101828", outline: "none",
                boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
                background: "#fff",
              }}
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#667085" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#0f5b6c", fontWeight: 600, textDecoration: "none" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
