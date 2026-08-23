import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Alert } from "@/integrations/vyra/types";
import { formatElapsed } from "@/lib/kirvra-format";
import { DriverAvatar, SeverityBadge } from "./primitives";

/* ------------------------------------------------------------- FilterBar */

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-3 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-[150px] flex-col gap-1", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------ OperationalTable */

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => ReactNode;
}

export function OperationalTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyState,
  rowClassName,
}: {
  columns: Array<TableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  emptyState?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "px-3 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase",
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "border-b border-border/60 last:border-0 hover:bg-surface-raised/60",
                rowClassName?.(row),
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-3 align-middle text-foreground",
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left",
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------- AlertCard */

export function AlertCard({
  alert,
  driverName,
  compact = false,
}: {
  alert: Alert;
  driverName: string;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-surface px-3 py-3",
        alert.severity === "critico" ? "border-critical/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{alert.threatType}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <DriverAvatar initials={driverName.slice(0, 2)} size="sm" />
            {driverName}
          </p>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      <dl className="mt-2.5 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Localização</dt>
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dd className="min-w-0 flex-1">{alert.locationLabel}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Tempo desde a detecção</dt>
          <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dd className="tabular">{formatElapsed(alert.detectedAt)}</dd>
        </div>
      </dl>

      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to="/alertas/$alertId" params={{ alertId: alert.id }} search={{}}>
              Abrir alerta
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/sessoes/$sessionId"
              params={{ sessionId: alert.sessionId }}
              search={{}}
            >
              Acompanhar
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
