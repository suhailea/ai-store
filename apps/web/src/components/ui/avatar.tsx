import { cn } from "@/lib/utils";

/* Employee accent palette from design system */
const COLORS = [
  { bg: "#efedfb", text: "#5e4bc4" }, /* violet  — Noor  */
  { bg: "#fcebf2", text: "#b4366a" }, /* rose    — Layla */
  { bg: "#eaf0fc", text: "#2f62c9" }, /* blue    — Omar  */
  { bg: "#e6f5ee", text: "#17774f" }, /* green   — Maya  */
  { bg: "#fdf0e6", text: "#a84c0a" }, /* orange  — Zayd  */
  { bg: "#e6f2f4", text: "#0f5b6c" }, /* teal    — extra */
];

function colorFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return COLORS[sum % COLORS.length];
}

const SIZES = {
  sm: { outer: "h-7 w-7 text-xs",   text: "text-xs"  },
  md: { outer: "h-9 w-9 text-sm",   text: "text-sm"  },
  lg: { outer: "h-11 w-11 text-md", text: "text-base" },
};

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const color = colorFor(name);
  const s = SIZES[size];

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none",
        s.outer
      )}
      style={{ background: color.bg, color: color.text }}
    >
      {initials}
    </div>
  );
}
