import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Edit2,
  ShieldOff,
  Car,
  History,
  FileText,
  Ban,
  ShieldCheck,
  User,
  Clock,
  MapPin,
  ChevronRight,
} from "lucide-react";

import { KirvraAppShell, BackLink } from "@/components/kirvra/app-shell";
import {
  MetricCard,
  DriverAvatar,
  StatusBadge,
  Panel,
  PageHeader,
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { drivers, vehicles, sessions, alerts } from "@/mocks/kirvra-central";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_central/motoristas/$driverId")({
  component: DriverDetailPage,
});

function DriverDetailPage() {
  const { driverId } = Route.useParams();
  const driver = drivers.find((d) => d.id === driverId);

  if (!driver) {
    return (
      <KirvraAppShell title="Motorista não encontrado">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Motorista não encontrado.</p>
          <Button variant="link" asChild className="mt-2">
            <Link to="/motoristas">Voltar para a lista</Link>
          </Button>
        </div>
      </KirvraAppShell>
    );
  }

  const driverVehicles = vehicles.filter((v) => v.driverId === driver.id);
  const driverSessions = sessions.filter((s) => s.driverId === driver.id);
  const driverAlerts = alerts.filter((a) => a.driverId === driver.id);

  return (
    <KirvraAppShell title="Detalhe do motorista">
      <div className="flex flex-col gap-4">
        <BackLink to="/motoristas" label="Voltar para a lista" />

        <PageHeader
          title={driver.displayName}
          description={`Motorista verificado · cadastro desde ${format(new Date(driver.registeredAt), "dd/MM/yyyy", { locale: ptBR })}`}
          className={undefined}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Edit2 className="h-3.5 w-3.5" />
                Editar cadastro
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2 bg-critical text-critical-foreground hover:bg-critical/90"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Suspender acesso
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* Perfil Principal */}
            <Panel
              className="relative overflow-hidden"
              bodyClassName={undefined}
              title={undefined}
              description={undefined}
              actions={undefined}
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex flex-col items-center gap-3">
                  <DriverAvatar initials={driver.initials} size="lg" />
                  <StatusBadge
                    tone={driver.registrationStatus === "verificado" ? "success" : "warning"}
                  >
                    {driver.registrationStatus === "verificado"
                      ? "Verificado"
                      : driver.registrationStatus === "suspenso"
                        ? "Suspenso"
                        : "Em análise"}
                  </StatusBadge>
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    Dados Cadastrais
                  </h3>
                  <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <DataField label="Nome completo" value={driver.fullName || "—"} />
                    <DataField label="CPF" value={driver.maskedDocument || "—"} />
                    <DataField label="Telefone" value={driver.phone || "—"} />
                    <DataField
                      label="Nascimento"
                      value={
                        driver.birthDate ? format(new Date(driver.birthDate), "dd/MM/yyyy") : "—"
                      }
                    />
                    <DataField
                      label="Assinatura"
                      value={
                        <StatusBadge
                          tone={driver.subscriptionStatus === "ativa" ? "success" : "warning"}
                        >
                          {driver.subscriptionStatus === "ativa"
                            ? "Ativa"
                            : driver.subscriptionStatus === "cancelada"
                              ? "Cancelada"
                              : "Pendente"}
                        </StatusBadge>
                      }
                    />
                    <DataField
                      label="Termos"
                      value={driver.termsAccepted ? "Aceitos" : "Não aceitos"}
                    />
                    <DataField
                      label="Contato emergencial"
                      value={
                        driver.emergencyContact
                          ? `${driver.emergencyContact.name} (${driver.emergencyContact.relationship || "Outro"})`
                          : "—"
                      }
                    />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Veículos */}
            <Panel
              title="Veículos"
              className={undefined}
              bodyClassName={undefined}
              description={undefined}
              actions={
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Ver todos
                </Button>
              }
            >
              <div className="space-y-3">
                {driverVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-muted-foreground">
                        <Car className="h-5 w-5" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-semibold text-foreground">
                          {v.make} {v.model} {v.year} · <span className="uppercase">{v.plate}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {v.color} · {v.documentVerified ? "documento verificado" : "pendente"}
                        </p>
                      </div>
                    </div>
                    {v.isPrimary && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                        Principal
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            {/* Resumo Operacional */}
            <Panel
              title="Resumo operacional"
              className={undefined}
              bodyClassName={undefined}
              actions={undefined}
              description={undefined}
            >
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Sessões"
                  value={(driver.sessionCount90d || 0).toString()}
                  tone="neutral"
                  className={undefined}
                />
                <MetricCard
                  label="Alertas"
                  value={String(driver.alertCount || 0)}
                  tone="neutral"
                  className={undefined}
                />
              </div>
            </Panel>

            {/* Atividade Recente */}
            <Panel
              title="Atividade recente"
              className={undefined}
              bodyClassName={undefined}
              actions={undefined}
              description={undefined}
            >
              <div className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-border">
                <TimelineItem
                  number={1}
                  title="Proteção iniciada"
                  time="Hoje, 19:47 · Honda Civic"
                />
                <TimelineItem
                  number={2}
                  title="Alerta crítico recebido"
                  time="Hoje, 20:14 · possível arma"
                  tone="critical"
                />
                <TimelineItem
                  number={3}
                  title="Operadora assumiu"
                  time="Hoje, 20:14 · Marina Duarte"
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </KirvraAppShell>
  );
}

function DataField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TimelineItem({
  number,
  title,
  time,
  tone = "neutral",
  className,
}: {
  number: number;
  title: string;
  time: string;
  tone?: "neutral" | "critical" | "primary" | "success" | "warning" | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative pl-8", className)}>
      <div
        className={cn(
          "absolute left-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold",
          tone === "critical"
            ? "bg-critical text-critical-foreground"
            : tone === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {number}
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}
