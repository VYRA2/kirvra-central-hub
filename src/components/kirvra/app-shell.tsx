import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  Camera,
  Car,
  ChevronLeft,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EMPLOYEE_ROLE_LABEL } from "@/integrations/vyra/types";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/services/auth-service";
import { KirvraWordmark } from "./brand";
import {
  DriverAvatar,
  PendingIntegrationNotice,
  SystemOnlineBadge,
} from "./primitives";

interface NavItem {
  label: string;
  to: string;
  icon: typeof Gauge;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { label: "Central de Comando", to: "/central", icon: LayoutDashboard },
      { label: "Monitoramento", to: "/monitoramento", icon: Radar },
      { label: "Alertas", to: "/alertas", icon: ShieldAlert },
      { label: "Motoristas", to: "/motoristas", icon: Users },
      { label: "Veículos", to: "/veiculos", icon: Car },
      { label: "Evidências", to: "/evidencias", icon: Camera },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Equipe", to: "/equipe", icon: UsersRound },
      { label: "Escalas", to: "/escalas", icon: CalendarClock },
      { label: "Relatórios", to: "/relatorios", icon: FileBarChart },
      { label: "Auditoria", to: "/auditoria", icon: ScrollText },
      { label: "Saúde do sistema", to: "/saude-do-sistema", icon: Gauge },
      { label: "Configurações", to: "/configuracoes", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, to: string) {
  if (to === "/alertas") {
    return pathname === "/alertas" || pathname.startsWith("/alertas/");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function KirvraSidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação principal da Central"
      className="flex h-full flex-col gap-6 overflow-y-auto bg-sidebar px-3 py-4"
    >
      <div className={cn("px-1", collapsed && "flex justify-center px-0")}>
        {collapsed ? (
          <KirvraWordmark className="[&>div]:hidden" />
        ) : (
          <KirvraWordmark />
        )}
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active && "text-primary",
                      )}
                      aria-hidden="true"
                    />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function NotificationButton({ count = 3 }: { count?: number }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Notificações, ${count} não lidas`}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Notificações</span>
      <span className="tabular rounded bg-critical/15 px-1.5 py-0.5 text-[11px] font-semibold text-critical">
        {count}
      </span>
    </Button>
  );
}

export function UserMenu() {
  const { employee, session } = useAuth();
  const navigate = useNavigate();

  if (!employee) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-2 py-1.5 text-left hover:bg-surface-raised"
        >
          <DriverAvatar initials={employee.initials} size="sm" />
          <span className="hidden leading-tight md:block">
            <span className="block text-xs font-medium text-foreground">
              {employee.fullName}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {EMPLOYEE_ROLE_LABEL[employee.role]} · {employee.employeeCode}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {employee.fullName}
          <span className="mt-0.5 block">
            {EMPLOYEE_ROLE_LABEL[employee.role]} · {employee.employeeCode}
          </span>
          <span className="mt-1 block">
            Sessão {session?.backed ? "autenticada" : "de demonstração"} ·
            auditada
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate({ to: "/login" }));
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Encerrar sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KirvraTopbar({
  title,
  onToggleSidebar,
}: {
  title: string;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Alternar navegação lateral"
          className="text-muted-foreground"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <h2 className="truncate text-sm font-semibold tracking-wide text-foreground">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <SystemOnlineBadge />
        <NotificationButton />
        <UserMenu />
      </div>
    </header>
  );
}

export function BackLink({
  to,
  label,
  params,
}: {
  to: string;
  label: string;
  params?: Record<string, string> | undefined;
}) {
  return (
    <Link
      to={to as any}
      params={(params || undefined) as any}
      search={{} as any}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function KirvraAppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { session } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const apply = () => setCollapsed(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <KirvraSidebar collapsed={collapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 border-r border-sidebar-border">
            <KirvraSidebar
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
          <button
            type="button"
            aria-label="Fechar navegação"
            className="flex-1 bg-background/70"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <KirvraTopbar
          title={title}
          onToggleSidebar={() => {
            if (window.matchMedia("(max-width: 767px)").matches) {
              setMobileOpen((v) => !v);
            } else {
              setCollapsed((v) => !v);
            }
          }}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
            {session && !session.backed ? <PendingIntegrationNotice /> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
