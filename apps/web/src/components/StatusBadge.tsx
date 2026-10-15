import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus, EmployeeStatus } from "@staffroom/types";

const TASK_CONFIG: Record<TaskStatus, { label: string; variant: "muted" | "info" | "warning" | "success" | "destructive" | "default" }> = {
  queued:           { label: "Queued",          variant: "muted"       },
  running:          { label: "Working",         variant: "info"        },
  waiting_approval: { label: "Needs approval",  variant: "warning"     },
  done:             { label: "Done",            variant: "success"     },
  stopped:          { label: "Stopped",         variant: "destructive" },
  stale:            { label: "Stale",           variant: "destructive" },
};

const EMP_CONFIG: Record<EmployeeStatus, { label: string; variant: "success" | "muted" | "destructive" | "default" }> = {
  active: { label: "Active", variant: "success"     },
  paused: { label: "Paused", variant: "muted"       },
  fired:  { label: "Fired",  variant: "destructive" },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cfg = TASK_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const cfg = EMP_CONFIG[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:           "bg-[#22a06b]",
    running:          "bg-[#22a06b] animate-pulse",
    waiting_approval: "bg-[#f2a93b]",
    paused:           "bg-[#667085]",
    done:             "bg-[#22a06b]",
    stopped:          "bg-[#c0362c]",
    stale:            "bg-[#c0362c]",
    queued:           "bg-[#98a2b3]",
  };
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full flex-shrink-0",
        colors[status] ?? "bg-slate-300"
      )}
    />
  );
}
