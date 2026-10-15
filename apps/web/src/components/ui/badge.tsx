import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        /* design system tokens */
        default:     "bg-surface-sunken text-ink-secondary",
        secondary:   "bg-surface-sunken text-ink-secondary",
        success:     "bg-[#e8f6ee] text-[#157f4f]",
        warning:     "bg-[#fef4e4] text-[#b45309]",
        destructive: "bg-[#fdecea] text-[#c0362c]",
        info:        "bg-[#eaf1fc] text-[#1d63c8]",
        muted:       "bg-surface-sunken text-ink-muted",
        outline:     "border border-border text-ink-secondary",
        /* legacy aliases */
        danger:      "bg-[#fdecea] text-[#c0362c]",
        purple:      "bg-[#efedfb] text-[#5e4bc4]",
        blue:        "bg-[#eaf1fc] text-[#1d63c8]",
        indigo:      "bg-[#efedfb] text-[#5e4bc4]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
