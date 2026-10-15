export const EMP_COLORS = [
  { bg: "#efedfb", text: "#5e4bc4" },
  { bg: "#fcebf2", text: "#b4366a" },
  { bg: "#eaf0fc", text: "#2f62c9" },
  { bg: "#e6f5ee", text: "#17774f" },
  { bg: "#fdf0e6", text: "#a84c0a" },
  { bg: "#e6f2f4", text: "#0f5b6c" },
];

export function empColor(name: string) {
  let s = 0;
  for (const c of name) s += c.charCodeAt(0);
  return EMP_COLORS[s % EMP_COLORS.length];
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
