import { empColor, initials } from "../lib/emp";

export function EmpAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const c = empColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "9999px",
      background: c.bg, color: c.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, userSelect: "none",
    }}>
      {initials(name)}
    </div>
  );
}
