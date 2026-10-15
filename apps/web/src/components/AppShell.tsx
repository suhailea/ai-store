import { NavLink, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  SquareKanban,
  CircleCheck,
  MessageSquare,
  Users,
  Settings,
  Plug,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Calendar,
  Home,
  Zap,
} from "lucide-react";
import { empColor } from "@/lib/emp";
import { auth, approvalsApi, employeesApi } from "@/lib/api";
import type { Employee } from "@staffroom/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeData {
  user: { id: string; name: string; email: string; role: string };
  business: { id: string; name: string; industry: string; demoMode: boolean };
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/office",     icon: LayoutDashboard, label: "Office"      },
  { to: "/board",      icon: SquareKanban,    label: "Team board"  },
  { to: "/approvals",  icon: CircleCheck,     label: "Approvals", badge: true },
  { to: "/workflows",  icon: Zap,             label: "Workflows"   },
  { to: "/chat",       icon: MessageSquare,   label: "Chat"        },
  { to: "/team",       icon: Users,           label: "Team"        },
  { to: "/connectors", icon: Plug,            label: "Connectors"  },
  { to: "/settings",   icon: Settings,        label: "Settings"    },
];

// Status dot colors
const STATUS_DOT: Record<string, string> = {
  active:  "#22a06b",
  paused:  "#667085",
  fired:   "#c0362c",
};

// ─── AppShell ─────────────────────────────────────────────────────────────────

function SidebarContents({
  me,
  approvalCount,
  employees,
}: {
  me: MeData | null;
  approvalCount: number;
  employees: Employee[];
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const bizInitials = me?.business.name
    ? me.business.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "CS";

  return (
    <>
      {/* Logo / brand */}
      <SidebarHeader
        style={{
          height: "60px",
          borderBottom: "1px solid #123642",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "0" : "0 16px",
          justifyContent: collapsed ? "center" : "flex-start",
          flexShrink: 0,
        }}
      >
        {/* S icon tile */}
        <div
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: "#e6f2f4",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#0f5b6c", fontWeight: 700, fontSize: 11, lineHeight: 1 }}>AI</span>
        </div>
        {!collapsed && (
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
            AI Store
          </span>
        )}
      </SidebarHeader>

      <SidebarContent style={{ overflowX: "hidden" }}>

        {/* Business switcher */}
        <SidebarGroup style={{ padding: "8px 8px 4px" }}>
          <SidebarGroupContent>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
                    padding: collapsed ? "8px 0" : "8px 10px",
                    borderRadius: 8, cursor: "pointer",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                  className="hover:bg-sidebar-accent transition-colors duration-100"
                >
                  {/* Amber square */}
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "#f2a93b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: "#0b2530", fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
                      {bizInitials}
                    </span>
                  </div>
                  {!collapsed && (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, lineHeight: "18px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {me?.business.name ?? "…"}
                        </p>
                        <p style={{ color: "#8fb0bb", fontSize: 12, lineHeight: "16px", margin: 0 }}>
                          {me?.business.demoMode ? "Demo company" : "Business"}
                        </p>
                      </div>
                      <ChevronDown style={{ width: 14, height: 14, color: "#8fb0bb", flexShrink: 0 }} />
                    </>
                  )}
                </div>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">{me?.business.name ?? "Business"}</TooltipContent>
              )}
            </Tooltip>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Main nav */}
        <SidebarGroup style={{ padding: "4px 8px" }}>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to} style={{ textDecoration: "none", display: "block" }}>
                    {({ isActive }) => (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            className={cn(
                              "w-full h-[38px] flex items-center gap-2 px-3 rounded-md transition-colors duration-100 text-sm font-medium",
                              collapsed ? "justify-center" : "",
                              isActive
                                ? "bg-sidebar-accent text-white"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                            )}
                            style={{ height: 38 }}
                          >
                            <Icon
                              style={{
                                width: 16, height: 16, flexShrink: 0,
                                color: isActive ? "#ffffff" : "#8fb0bb",
                              }}
                              strokeWidth={1.75}
                            />
                            {!collapsed && (
                              <span style={{ color: isActive ? "#ffffff" : "#c9d6dc" }}>
                                {label}
                              </span>
                            )}
                            {!collapsed && badge && approvalCount > 0 && (
                              <SidebarMenuBadge
                                style={{
                                  background: "#f2a93b",
                                  color: "#0b2530",
                                  fontWeight: 600,
                                  fontSize: 11,
                                  borderRadius: 9999,
                                  minWidth: 20,
                                  height: 20,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "0 5px",
                                }}
                              >
                                {approvalCount}
                              </SidebarMenuBadge>
                            )}
                            {collapsed && badge && approvalCount > 0 && (
                              <span
                                style={{
                                  position: "absolute", top: 4, right: 4,
                                  width: 8, height: 8, borderRadius: 9999,
                                  background: "#f2a93b",
                                }}
                              />
                            )}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {collapsed && <TooltipContent side="right">{label}{badge && approvalCount > 0 ? ` (${approvalCount})` : ""}</TooltipContent>}
                      </Tooltip>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Employees section */}
        {employees.length > 0 && !collapsed && (
          <>
            <SidebarSeparator style={{ background: "#123642", margin: "4px 0" }} />
            <SidebarGroup style={{ padding: "4px 8px", flex: 1, minHeight: 0, overflowY: "auto" }}>
              <SidebarGroupLabel
                style={{
                  color: "#8fb0bb",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "8px 12px 4px",
                }}
              >
                Employees
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {employees.map((emp) => {
                    const { bg, text } = empColor(emp.displayName);
                    const initials = emp.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                    const role = emp.roleDescription.split(/[,–—]/)[0].trim();
                    return (
                      <SidebarMenuItem key={emp.id}>
                        <SidebarMenuButton
                          asChild
                          className="hover:bg-sidebar-accent/60 transition-colors duration-100"
                          style={{ height: 36 }}
                        >
                          <Link
                            to={`/team/${emp.id}`}
                            style={{
                              display: "flex", alignItems: "center",
                              gap: 8, padding: "6px 12px",
                              textDecoration: "none", borderRadius: 6,
                            }}
                          >
                            {/* 22px avatar */}
                            <div
                              style={{
                                width: 22, height: 22, borderRadius: 9999,
                                background: bg,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, fontSize: 10, fontWeight: 700, color: text, lineHeight: 1,
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "#c9d6dc", lineHeight: "18px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {emp.displayName}
                              </p>
                              <p style={{ fontSize: 11, color: "#8fb0bb", lineHeight: "14px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {role}
                              </p>
                            </div>
                            {/* Status dot */}
                            <span
                              style={{
                                width: 8, height: 8, borderRadius: 9999, flexShrink: 0,
                                background: STATUS_DOT[emp.status] ?? "#8fb0bb",
                              }}
                            />
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Hire or rehire footer */}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeData | null>(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    auth.me().then(setMe).catch(() => {});
    approvalsApi.list()
      .then((list) => setApprovalCount(list.filter((a) => a.approval.status === "pending").length))
      .catch(() => {});
    employeesApi.list()
      .then((list) => setEmployees(list.filter((e) => e.status !== "fired")))
      .catch(() => {});
  }, []);

  const userName = me?.user.name ?? "…";
  const userRole = me?.user.role ?? "";
  const userInitials = userName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const todaySpend = employees.reduce((sum, e) => sum + (e.budgetUsedUsd ?? 0), 0);
  const totalBudget = employees.reduce((sum, e) => sum + (e.budgetMonthlyUsd ?? 0), 0);

  return (
    <TooltipProvider delayDuration={0}>
    <SidebarProvider
      style={
        {
          "--sidebar-width": "248px",
          "--sidebar-width-mobile": "248px",
          "--sidebar-width-icon": "56px",
          height: "100svh",
          overflow: "hidden",
        } as React.CSSProperties
      }
    >
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <Sidebar
        collapsible="icon"
        className="border-r-0"
        style={{ background: "hsl(var(--sidebar-background))" }}
      >
        <SidebarContents me={me} approvalCount={approvalCount} employees={employees} />
      </Sidebar>

      {/* ── Main column ──────────────────────────────────────── */}
      <SidebarInset style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", background: "#f7f8fa" }}>

        {/* ── Topbar ── */}
        <header className="app-topbar"
          style={{
            height: 60,
            background: "#ffffff",
            borderBottom: "1px solid #e4e7ec",
            display: "flex", alignItems: "center",
            padding: "0 24px", gap: 12,
            flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
          }}
        >
          {/* Sidebar toggle */}
          <SidebarTrigger
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "none", background: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#667085", flexShrink: 0,
            }}
            className="hover:bg-[#f7f8fa] transition-colors"
          />

          {/* Search */}
          <div className="app-topbar-search"
            style={{
              width: 280, height: 36, borderRadius: 8,
              border: "1px solid #e4e7ec", background: "#f7f8fa",
              display: "flex", alignItems: "center", gap: 8, padding: "0 10px", flexShrink: 0,
            }}
          >
            <Search style={{ width: 14, height: 14, color: "#8fb0bb", flexShrink: 0 }} strokeWidth={1.75} />
            <span style={{ flex: 1, fontSize: 13, color: "#8fb0bb" }}>Search tasks, clients, files…</span>
            <kbd style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 5px", borderRadius: 4, border: "1px solid #e4e7ec", background: "#fff", fontSize: 11, fontWeight: 500, color: "#8fb0bb", fontFamily: "inherit" }}>
              ⌘K
            </kbd>
          </div>

          <div style={{ flex: 1 }} />

          {/* Approvals pill */}
          <button
            onClick={() => navigate("/approvals")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 10px", borderRadius: 6,
              border: "1px solid #e4e7ec", background: "#fff",
              cursor: "pointer", fontSize: 13, color: "#101828", fontWeight: 400,
            }}
          >
            <CircleCheck style={{ width: 14, height: 14, color: "#8fb0bb" }} strokeWidth={1.75} />
            <span>Approvals</span>
            {approvalCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 9999, background: "#f2a93b", color: "#0b2530", fontSize: 11, fontWeight: 600, padding: "0 4px", lineHeight: 1 }}>
                {approvalCount}
              </span>
            )}
          </button>

          {/* Today spend pill */}
          <div className="app-topbar-spend" style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 6, border: "1px solid #e4e7ec", background: "#fff", fontSize: 13, color: "#101828" }}>
            <Calendar style={{ width: 14, height: 14, color: "#8fb0bb" }} strokeWidth={1.75} />
            <span>Today&nbsp;</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500, fontSize: 13 }}>
              ${todaySpend.toFixed(2)} / ${totalBudget}
            </span>
          </div>

          {/* Bell */}
          <button style={{ position: "relative", width: 32, height: 32, borderRadius: 8, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell style={{ width: 16, height: 16, color: "#667085" }} strokeWidth={1.75} />
          </button>

          {/* User */}
          <div className="app-topbar-user" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9999, background: "#123642", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{userInitials}</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#101828", lineHeight: "18px", margin: 0 }}>{userName}</p>
              <p style={{ fontSize: 11, color: "#667085", lineHeight: "14px", margin: 0, textTransform: "capitalize" }}>{userRole}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0, background: "#f7f8fa" }}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <div style={{ background: "#fff", padding: "20px 32px", borderBottom: "1px solid #e4e7ec", flexShrink: 0 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ marginBottom: 8 }}>
          <ol style={{ display: "flex", alignItems: "center", gap: 4, listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
            <li>
              <Link to="/" style={{ color: "#667085", textDecoration: "none", display: "flex", alignItems: "center" }}>
                <Home style={{ width: 14, height: 14 }} strokeWidth={1.75} />
              </Link>
            </li>
            {breadcrumbs.map((crumb, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight style={{ width: 14, height: 14, color: "#d0d5dd" }} strokeWidth={1.75} />
                {crumb.href && i < breadcrumbs.length - 1 ? (
                  <Link to={crumb.href} style={{ color: "#667085", textDecoration: "none" }}>{crumb.label}</Link>
                ) : (
                  <span style={{ color: "#101828", fontWeight: 500 }}>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.01em", color: "#101828", margin: 0 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 14, lineHeight: "20px", color: "#667085", marginTop: 4, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{action}</div>}
      </div>
    </div>
  );
}
