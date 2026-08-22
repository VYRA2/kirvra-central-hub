import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  Inbox,
  Loader2,
  Lock,
  WifiOff,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AlertSeverity,
  AlertState,
  RiskLevel,
} from "@/integrations/vyra/types";

/* ---------------------------------------------------------------- badges */

const TONE_CLASS = {
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/12 text-primary border-primary/35",
  success: "bg-success/12 text-success border-success/35",
  warning: "bg-warning/12 text-warning border-warning/35",
  critical: "bg-critical/15 text-critical border-critical/40",
} as const;

export type BadgeTone = keyof typeof TONE_CLASS;

export function StatusBadge({
  children,
  tone = "neutral",
  dot = true,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  normal: "success",
  atencao: "warning",
  suspeito: "warning",
  critico: "critical",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "Normal",
  atencao: "Atenção",
  suspeito: "Suspeito",
  critico: "Crítico",
};

export function RiskBadge({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  return (
    <StatusBadge tone={RISK_TONE[level]} className={className}>
      {RISK_LABEL[level]}
    </StatusBadge>
  );
}

const SEVERITY_TONE: Record<AlertSeverity, BadgeTone> = {
  atencao: "warning",
  suspeito: "warning",
  critico: "critical",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  atencao: "Atenção",
  suspeito: "Suspeito",
  critico: "Crítico",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <StatusBadge tone={SEVERITY_TONE[severity]}>
      {SEVERITY_LABEL[severity]}
    </StatusBadge>
  );
}

const ALERT_STATE_LABEL: Record<AlertState, string> = {
  novo: "Novo",
  assumido: "Assumido",
  em_analise: "Em análise",
  confirmado: "Confirmado",
  falso_positivo: "Falso positivo",
  encerrado: "Encerrado",
};

const ALERT_STATE_TONE: Record<AlertState, BadgeTone> = {
  novo: "critical",
  assumido: "primary",
  em_analise: "warning",
  confirmado: "critical",
  falso_positivo: "neutral",
  encerrado: "success",
};

export function AlertStateBadge({ state }: { state: AlertState }) {
  return (
    <StatusBadge tone={ALERT_STATE_TONE[state]}>
      {ALERT_STATE_LABEL[state]}
    </StatusBadge>
  );
}

export function SystemOnlineBadge({ online = true }: { online?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        online
          ? "border-success/40 bg-success/10 text-success"
          : "border-critical/40 bg-critical/10 text-critical",
      )}
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_oklab,currentColor_25%,transparent)]"
      />
      {online ? "Sistemas online" : "Sistemas instáveis"}
    </span>
  );
}

/* ----------------------------------------------------------------- cards */

export function MetricCard({
  label,
  value,
  hint,
  sublabel,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  sublabel?: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const valueTone =
    tone === "critical"
      ? "text-critical"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : tone === "primary"
            ? "text-primary"
            : "text-foreground";

  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-3", className)}>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("tabular mt-1.5 text-2xl font-semibold", valueTone)}>
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      ) : null}
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", bodyClassName ?? "p-4")}>
        {children}
      </div>
    </section>
  );
}

export function DriverAvatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/12 font-semibold text-primary",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/* ---------------------------------------------------------------- estados */

function StateShell({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: BadgeTone;
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <span className={toneClass}>{icon}</span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title = "Nenhum registro encontrado",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateShell
      icon={<Inbox className="h-6 w-6" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Tente novamente. Se o erro persistir, acione o suporte da Central.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateShell
      icon={<AlertTriangle className="h-6 w-6" />}
      title={title}
      description={description}
      action={action}
      tone="critical"
    />
  );
}

export function OfflineState({
  title = "Sem conexão com a Central",
  description = "Exibindo o último estado conhecido. A reconexão é automática.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateShell
      icon={<WifiOff className="h-6 w-6" />}
      title={title}
      description={description}
      tone="warning"
    />
  );
}

export function PermissionDeniedState({
  description = "Seu cargo não possui autorização para visualizar este conteúdo.",
}: {
  description?: string;
}) {
  return (
    <StateShell
      icon={<Lock className="h-6 w-6" />}
      title="Sem permissão"
      description={description}
      tone="warning"
    />
  );
}

export function SessionExpiredState({ action }: { action?: ReactNode }) {
  return (
    <StateShell
      icon={<Ban className="h-6 w-6" />}
      title="Sessão expirada"
      description="Por segurança, autentique-se novamente para continuar."
      action={action}
      tone="warning"
    />
  );
}

export function LoadingState({
  label = "Carregando dados operacionais…",
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {label}
      </p>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function PendingIntegrationNotice({
  message = "Integração pendente: a Central ainda não está conectada ao Supabase VYRA2. Os dados exibidos são de demonstração e nenhuma ação crítica é gravada.",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function RealtimeIndicator({
  status,
  lastUpdate,
}: {
  status: "pendente" | "conectado" | "desconectado";
  lastUpdate: string;
}) {
  const tone: BadgeTone =
    status === "conectado"
      ? "success"
      : status === "pendente"
        ? "warning"
        : "critical";
  const label =
    status === "conectado"
      ? "Atualização ao vivo"
      : status === "pendente"
        ? "Tempo real pendente"
        : "Tempo real desconectado";
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <span className="tabular text-[11px] text-muted-foreground">
        Último dado {lastUpdate}
      </span>
    </span>
  );
}
