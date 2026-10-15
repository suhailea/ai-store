import { useNavigate } from "react-router-dom";
import { auth } from "../lib/api";
import { useAuthStore } from "../store/auth";

export default function Landing() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleDemo() {
    const data = await auth.demo();
    setAuth(data.token, data.userId, data.businessId, true);
    navigate("/office");
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <h1 style={styles.title}>AI Store</h1>
        <p style={styles.tagline}>
          Hire a team of AI employees. Give them access. Approve their work.
        </p>
        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={() => navigate("/signup")}>
            Hire your team
          </button>
          <button style={styles.secondaryBtn} onClick={handleDemo}>
            Try the demo company
          </button>
        </div>
      </div>

      <div style={styles.cards}>
        {ROLES.map((r) => (
          <div key={r.name} style={{ ...styles.card, borderTop: `3px solid ${r.color}` }}>
            <div style={styles.cardAvatar}>{r.emoji}</div>
            <div style={styles.cardName}>{r.name}</div>
            <div style={styles.cardRole}>{r.role}</div>
            <div style={styles.cardDesc}>{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLES = [
  { name: "Layla", role: "Personal Assistant", emoji: "👩‍💼", color: "#6366f1", desc: "Inbox triage, morning brief, reply drafts" },
  { name: "Omar", role: "Docs & Data", emoji: "📊", color: "#0ea5e9", desc: "Spreadsheets, weekly reports, file answers" },
  { name: "Maya", role: "Client Success", emoji: "🤝", color: "#10b981", desc: "Feedback collection, at-risk client alerts" },
  { name: "Zayd", role: "Sales", emoji: "📞", color: "#f59e0b", desc: "Call notes, CRM updates, proposal drafts" },
  { name: "Noor", role: "Manager", emoji: "🧭", color: "#8b5cf6", desc: "Breaks goals into tasks, coordinates the team" },
];

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 48 },
  hero: { textAlign: "center", maxWidth: 560 },
  title: { fontSize: 48, fontWeight: 700, letterSpacing: -1 },
  tagline: { marginTop: 16, fontSize: 18, color: "#555", lineHeight: 1.6 },
  actions: { marginTop: 32, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  primaryBtn: { padding: "12px 28px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { padding: "12px 28px", background: "#fff", color: "#1a1a1a", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  cards: { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 960 },
  card: { background: "#fff", borderRadius: 12, padding: "20px 16px", width: 170, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" },
  cardAvatar: { fontSize: 32, marginBottom: 8 },
  cardName: { fontWeight: 700, fontSize: 15 },
  cardRole: { fontSize: 12, color: "#888", marginTop: 2, marginBottom: 8 },
  cardDesc: { fontSize: 12, color: "#555", lineHeight: 1.5 },
};
