import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  Mic,
  Navigation,
  NotebookPen,
  Signal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KirvraAppShell, BackLink } from "@/components/kirvra/app-shell";
import { ConfirmActionDialog } from "@/components/kirvra/confirm-action-dialog";
import { LiveMapPanel } from "@/components/kirvra/map-panel";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  RiskBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import {
  formatClock,
  formatElapsed,
  formatTime,
  maskPhone,
} from "@/lib/kirvra-format";
import {
  addSessionNote,
  escalateSession,
  getSessionDetail,
} from "@/services/session-service";
import type { SensorState } from "@/integrations/vyra/types";

export const Route = createFileRoute("/_central/sessoes/$sessionId")({
  component: SessionPage,
});

const SENSOR_LABEL: Record<SensorState, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  indisponivel: "Indisponível",
};

const SENSOR_TONE: Record<SensorState, "success" | "warning" | "critical"> = {
  ativo: "success",
  inativo: "warning",
  indisponivel: "critical",
};

function SensorTile({
  icon,
  label,
  state,
  updatedAt,
}: {
  icon: React.ReactNode;
  label: string;
  state: SensorState;
  updatedAt: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </span>
        <StatusBadge tone={SENSOR_TONE[state]}>
          {SENSOR_LABEL[state]}
        </StatusBadge>
      </div>
      <p className="tabular mt-2 text-[11px] text-muted-foreground">
        {state === "indisponivel"
          ? "Sem dados do dispositivo"
          : `Atualizado ${formatElapsed(updatedAt)} · ${formatTime(updatedAt)}`}
      </p>
    </div>
  );
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const [noteOpen, setNoteOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSessionDetail(sessionId),
  });

  return (
    <KirvraAppShell title="Sessão protegida">
      <BackLink to="/monitoramento" label="Voltar ao monitoramento" />

      {isLoading ? <LoadingState rows={4} /> : null}
      {isError ? (
        <ErrorState
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
        />
      ) : null}
      {!isLoading && !isError && !data ? (
        <EmptyState
          title="Sessão não encontrada"
          description={`Nenhuma sessão corresponde ao identificador ${sessionId}.`}
          className={undefined}
          action={
            <Button asChild variant="outline">
              <Link to="/monitoramento">Voltar ao monitoramento</Link>
            </Button>
          }
        />
      ) : null}

      {data ? (
        <>
          <PageHeader
            title={`Sessão de ${data.driver.displayName}`}
            description={`Início às ${formatTime(data.session.startedAt)} · ${
              data.vehicle
                ? `${data.vehicle.make} ${data.vehicle.model} · ${data.vehicle.plate}`
                : "Veículo não informado"
            }`}
            className={undefined}
            actions={
              <>
                <Button variant="outline" onClick={() => setNoteOpen(true)}>
                  <NotebookPen className="h-4 w-4" aria-hidden="true" />
                  Adicionar observação
                </Button>
                <Button variant="destructive" onClick={() => setEscalateOpen(true)}>
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  Escalar ao supervisor
                </Button>
              </>
            }
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Tempo protegido"
              value={formatClock(data.session.startedAt)}
              className={undefined}
              tone={undefined}
              sublabel={undefined}
              hint={undefined}
            />
            <MetricCard
              label="Último heartbeat"
              value={formatElapsed(data.session.lastHeartbeatAt)}
              hint={formatTime(data.session.lastHeartbeatAt)}
              tone={
                Date.now() - new Date(data.session.lastHeartbeatAt).getTime() >
                60_000
                  ? "warning"
                  : "success"
              }
              className={undefined}
              sublabel={undefined}
            />
            <MetricCard
              label="Risk score"
              value={String(data.session.riskScore)}
              hint="Sinal do KIRVRA AI Engine"
              tone={data.session.riskScore >= 70 ? "critical" : "neutral"}
              className={undefined}
              sublabel={undefined}
            />
            <MetricCard
              label="Nível de risco"
              value={
                data.session.riskLevel === "critico"
                  ? "Crítico"
                  : data.session.riskLevel === "suspeito"
                    ? "Suspeito"
                    : data.session.riskLevel === "atencao"
                      ? "Atenção"
                      : "Normal"
              }
              hint="Revisão humana obrigatória"
              tone={data.session.riskLevel === "critico" ? "critical" : "warning"}
            />
            <MetricCard
              label="Alertas"
              value={String(data.sessionAlerts.length)}
              hint={undefined}
              className={undefined}
              tone={undefined}
              sublabel={undefined}
            />
            <MetricCard
              label="Localização"
              value={data.session.state === "offline" ? "Offline" : "Ao vivo"}
              hint={undefined}
              tone={data.session.state === "offline" ? "critical" : "success"}
              className={undefined}
              sublabel={undefined}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Trajeto e localização atual"
              description={data.session.location.address}
              bodyClassName="p-0"
              className={undefined}
              actions={undefined}
            >
              <LiveMapPanel
                className="min-h-[400px] rounded-none border-0"
                activeId={data.session.id}
                track={data.session.track}
                markers={[
                  {
                    id: data.session.id,
                    label: data.driver.displayName,
                    x: data.session.mapPosition.x,
                    y: data.session.mapPosition.y,
                    risk: data.session.riskLevel,
                    offline: data.session.state === "offline",
                  },
                ]}
                overlay={
                  data.sessionAlerts[0] ? (
                    <div className="absolute top-4 right-4 w-[280px] rounded-lg border border-critical/40 bg-card/95 p-3 backdrop-blur-sm">
                      <p className="text-sm font-semibold text-foreground">
                        {data.sessionAlerts[0].threatType}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {data.sessionAlerts[0].locationLabel}
                      </p>
                      <p className="tabular mt-1 text-[11px] text-muted-foreground">
                        Detectado {formatElapsed(data.sessionAlerts[0].detectedAt)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" asChild>
                          <Link
                            to="/alertas/$alertId"
                            params={{ alertId: data.sessionAlerts[0].id }}
                          >
                            Abrir alerta
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to={"/motoristas/$driverId" as any}
                            params={{ driverId: data.driver.id } as any}
                            search={{} as any}
                          >
                            Acompanhar motorista
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : null
                }
              />
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title="Dados da motorista" className={undefined} bodyClassName={undefined} actions={undefined} description={undefined}>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Nome</dt>
                    <dd className="text-right text-foreground">
                      {data.driver.fullName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Verificação</dt>
                    <dd>
                      <StatusBadge
                        tone={
                          data.driver.registrationStatus === "verificado"
                            ? "success"
                            : "warning"
                        }
                        dot={undefined}
                        className={undefined}
                      >
                        {data.driver.registrationStatus === "verificado"
                          ? "Cadastro verificado"
                          : "Cadastro em análise"}
                      </StatusBadge>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Assinatura</dt>
                    <dd>
                      <StatusBadge
                        tone={
                          data.driver.subscriptionStatus === "ativa"
                            ? "success"
                            : "warning"
                        }
                      >
                        {data.driver.subscriptionStatus === "ativa"
                          ? "Ativa"
                          : "Pendente"}
                      </StatusBadge>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="tabular text-foreground">
                      {maskPhone(data.driver.phone)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Veículo</dt>
                    <dd className="text-right text-foreground">
                      {data.vehicle
                        ? `${data.vehicle.make} ${data.vehicle.model}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Placa</dt>
                    <dd className="tabular text-foreground">
                      {data.vehicle?.plate ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Contato emergencial</dt>
                    <dd className="text-right text-foreground">
                      {data.driver.emergencyContact
                        ? `${data.driver.emergencyContact.name} · ${maskPhone(
                            data.driver.emergencyContact.phone ?? "",
                          )}`
                        : "Não informado"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <RiskBadge level={data.session.riskLevel} />
                  <Button size="sm" variant="link" asChild className="h-auto p-0">
                    <Link
                      to={"/motoristas/$driverId" as any}
                      params={{ driverId: data.driver.id } as any}
                      search={{} as any}
                    >
                      Abrir perfil
                    </Link>
                  </Button>
                </div>
              </Panel>

              <Panel title="Sensores da sessão" bodyClassName="grid gap-3 p-4 sm:grid-cols-2" className={undefined} actions={undefined} description={undefined}>
                <SensorTile
                  icon={<Camera className="h-4 w-4" aria-hidden="true" />}
                  label="Câmera"
                  state={data.session.sensors.camera}
                  updatedAt={data.session.sensors.updatedAt}
                />
                <SensorTile
                  icon={<Mic className="h-4 w-4" aria-hidden="true" />}
                  label="Áudio"
                  state={data.session.sensors.audio}
                  updatedAt={data.session.sensors.updatedAt}
                />
                <SensorTile
                  icon={<Navigation className="h-4 w-4" aria-hidden="true" />}
                  label="GPS"
                  state={data.session.sensors.gps}
                  updatedAt={data.session.sensors.updatedAt}
                />
                <SensorTile
                  icon={<Signal className="h-4 w-4" aria-hidden="true" />}
                  label="Central / conectividade"
                  state={data.session.sensors.network}
                  updatedAt={data.session.sensors.updatedAt}
                />
              </Panel>
            </div>
          </div>

          <ConfirmActionDialog
            open={noteOpen}
            onOpenChange={setNoteOpen}
            title="Adicionar observação"
            description="A observação fica registrada na linha do tempo da sessão com seu identificador de funcionário."
            confirmLabel="Salvar observação"
            reasonLabel="Observação"
            reasonPlaceholder="Descreva o que foi observado nesta sessão"
            onConfirm={async (note) => {
              const result = await addSessionNote(sessionId, note);
              if (result.status === "pending") toast.warning(result.message);
              if (result.status === "error") toast.error(result.message);
              return result;
            }}
          />

          <ConfirmActionDialog
            open={escalateOpen}
            onOpenChange={setEscalateOpen}
            title="Escalar ao supervisor"
            description="A escalada notifica o supervisor de turno e transfere a responsabilidade do acompanhamento."
            confirmLabel="Confirmar escalada"
            destructive
            reasonLabel="Motivo da escalada"
            reasonPlaceholder="Explique por que a sessão precisa de um supervisor"
            onConfirm={async (reason) => {
              const result = await escalateSession(sessionId, reason);
              if (result.status === "pending") toast.warning(result.message);
              if (result.status === "error") toast.error(result.message);
              return result;
            }}
          />
        </>
      ) : null}
    </KirvraAppShell>
  );
}
