import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { RequirePermission } from "@/components/kirvra/access-control";
import { BackLink, KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  DriverAvatar,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDriverActivityDate, getDriverDetail } from "@/services/driver-service";

export const Route = createFileRoute("/_central/motoristas/$driverId")({
  component: DriverDetailPage,
});

function DriverDetailPage() {
  const { driverId } = Route.useParams();
  const detailQuery = useQuery({
    queryKey: ["driver-detail", driverId],
    queryFn: () => getDriverDetail(driverId),
    staleTime: 30_000,
  });

  return (
    <KirvraAppShell title="Detalhe do motorista">
      <RequirePermission permissions={["drivers.view"]}>
        {detailQuery.isLoading ? (
          <LoadingState label="Carregando motorista real do VYRA2..." rows={6} />
        ) : detailQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar o motorista"
            description="Verifique a conexão e sua permissão de acesso."
            action={
              <Button variant="outline" onClick={() => void detailQuery.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : !detailQuery.data ? (
          <EmptyState
            title="Motorista não encontrado"
            description="O cadastro solicitado não existe ou não está visível para seu cargo."
            action={
              <Button variant="outline" asChild>
                <Link to="/motoristas">Voltar para a lista</Link>
              </Button>
            }
          />
        ) : (
          <DriverContent detail={detailQuery.data} />
        )}
      </RequirePermission>
    </KirvraAppShell>
  );
}

function DriverContent({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getDriverDetail>>>;
}) {
  const { driver, vehicles, activity } = detail;
  const registrationLabel =
    driver.registrationStatus === "verificado"
      ? "Verificado"
      : driver.registrationStatus === "suspenso"
        ? "Suspenso"
        : driver.registrationStatus === "em_analise"
          ? "Em análise"
          : "Pendente";

  return (
    <div className="flex flex-col gap-4">
      <BackLink to="/motoristas" label="Voltar para a lista" />
      <PageHeader
        title={driver.displayName}
        description={`Cadastro real no VYRA2 desde ${format(new Date(driver.registeredAt), "dd/MM/yyyy", { locale: ptBR })}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex flex-col items-center gap-3">
                <DriverAvatar initials={driver.initials} size="lg" />
                <StatusBadge
                  tone={
                    driver.registrationStatus === "verificado"
                      ? "success"
                      : driver.registrationStatus === "suspenso"
                        ? "critical"
                        : "warning"
                  }
                >
                  {registrationLabel}
                </StatusBadge>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Dados cadastrais
                </h3>
                <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <DataField label="Nome completo" value={driver.fullName} />
                  <DataField label="CPF" value={driver.maskedDocument} />
                  <DataField label="Telefone" value={driver.phone} />
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
                </dl>
              </div>
            </div>
          </Panel>

          <Panel title="Veículos">
            {vehicles.length ? (
              <div className="space-y-3">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-muted-foreground">
                        <Car className="h-5 w-5" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-semibold text-foreground">
                          {vehicle.make} {vehicle.model}
                          {vehicle.year ? ` ${vehicle.year}` : ""} ·{" "}
                          <span className="uppercase">{vehicle.plate}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {vehicle.color} ·{" "}
                          {vehicle.documentVerified ? "documento verificado" : "documento pendente"}
                        </p>
                      </div>
                    </div>
                    {vehicle.isPrimary ? <StatusBadge tone="success">Principal</StatusBadge> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum veículo cadastrado para este motorista.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Resumo operacional">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Sessões em 90 dias"
                value={String(driver.sessionCount90d)}
                tone="neutral"
              />
              <MetricCard label="Alertas" value={String(driver.alertCount)} tone="neutral" />
            </div>
          </Panel>

          <Panel title="Atividade recente">
            {activity.length ? (
              <div className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-border">
                {activity.map((entry, index) => (
                  <TimelineItem
                    key={entry.id}
                    number={index + 1}
                    title={entry.title}
                    time={`${formatDriverActivityDate(entry.occurredAt)} · ${entry.detail}`}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não há sessões ou alertas para este motorista.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
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
}: {
  number: number;
  title: string;
  time: string;
  tone?: "neutral" | "critical";
}) {
  return (
    <div className="relative pl-8">
      <div
        className={cn(
          "absolute left-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold",
          tone === "critical"
            ? "bg-critical text-critical-foreground"
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
