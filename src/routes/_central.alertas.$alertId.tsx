import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleSlash,
  Expand,
  ImagePlus,
  NotebookPen,
  Play,
  ShieldAlert,
  SquareCheck,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { BackLink, KirvraAppShell } from "@/components/kirvra/app-shell";
import { ConfirmActionDialog } from "@/components/kirvra/confirm-action-dialog";
import { LiveMapPanel } from "@/components/kirvra/map-panel";
import {
  AlertStateBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SeverityBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import {
  formatClock,
  formatElapsed,
  formatTime,
  maskPhone,
} from "@/lib/kirvra-format";
import {
  addAlertNote,
  closeAlert,
  confirmThreat,
  escalateAlert,
  getAlertDetail,
  markFalsePositive,
  startProtocol,
  transferAlert,
} from "@/services/alert-service";
import { findSession, operators } from "@/mocks/kirvra-central";
import type { ServiceResult } from "@/services/auth-service";

export const Route = createFileRoute("/_central/alertas/$alertId")({
  component: AlertHandlingPage,
});

type DialogKind =
  | "confirmar"
  | "nota"
  | "protocolo"
  | "falso"
  | "encerrar"
  | "transferir"
  | "escalar"
  | null;

function AlertHandlingPage() {
  const { alertId } = Route.useParams();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [target, setTarget] = useState("");
  const [volume, setVolume] = useState([70]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => getAlertDetail(alertId),
  });

  const report = (result: ServiceResult) => {
    if (result.status === "pending") toast.warning(result.message);
    if (result.status === "error") toast.error(result.message);
    return result;
  };

  const session = data ? findSession(data.alert.sessionId) : null;

  return (
    <KirvraAppShell title="Atendimento do alerta">
      <BackLink to="/alertas" label="Voltar à fila de alertas" />

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? (
        <ErrorState
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
        />
      ) : null}
      {!isLoading && !isError && !data ? (
        <EmptyState
          title="Alerta não encontrado"
          description={`Nenhum alerta corresponde ao identificador ${alertId}.`}
          action={
            <Button variant="outline" asChild>
              <Link to="/alertas" search={{} as any}>Voltar à fila</Link>
            </Button>
          }
        />
      ) : null}

      {data ? (
        <>
          <PageHeader
            title={`Protocolo ${data.alert.protocol}`}
            description={`${data.alert.threatType} · detectado ${formatElapsed(
              data.alert.detectedAt,
            )} (${formatTime(data.alert.detectedAt)})`}
            actions={
              data.readOnly ? (
                <StatusBadge tone="neutral">
                  Modo histórico · somente leitura
                </StatusBadge>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDialog("transferir")}>
                    <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                    Transferir
                  </Button>
                  <Button variant="destructive" onClick={() => setDialog("escalar")}>
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    Escalar ao supervisor
                  </Button>
                </>
              )
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={data.alert.severity} />
            <AlertStateBadge state={data.alert.state} />
            <StatusBadge tone="warning" dot={false}>
              Confiança da IA {Math.round(data.alert.confidence * 100)}% · sinal
              para revisão humana
            </StatusBadge>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              <Panel
                title="Localização ao vivo"
                description={
                  session
                    ? `${session.location.address} · último GPS ${formatElapsed(
                        session.location.capturedAt,
                      )}`
                    : "Sessão sem localização disponível"
                }
                bodyClassName="p-0"
              >
                <LiveMapPanel
                  className="min-h-[300px] rounded-none border-0"
                  activeId={session?.id ?? null}
                  track={session?.track || (undefined as any)}
                  markers={
                    session
                      ? [
                          {
                            id: session.id,
                            label: data.driver.displayName,
                            x: session.mapPosition.x,
                            y: session.mapPosition.y,
                            risk: session.riskLevel,
                            offline: session.state === "offline",
                          },
                        ]
                      : []
                  }
                  footer={
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular text-xs text-muted-foreground">
                        {session
                          ? `Precisão ${session.location.accuracyMeters} m`
                          : "—"}
                      </span>
                      {session ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/sessoes/$sessionId"
                            params={{ sessionId: session.id }}
                          >
                            Abrir sessão
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  }
                />
              </Panel>

              <Panel
                title="Evidência visual"
                description={
                  data.evidence
                    ? `${data.evidence.cameraLabel} · ${formatTime(
                        data.evidence.capturedAt,
                      )}`
                    : "Sem evidência associada"
                }
                actions={
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!data.evidence}>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Reproduzir clipe
                    </Button>
                    <Button size="sm" variant="outline" disabled={!data.evidence}>
                      <Expand className="h-3.5 w-3.5" aria-hidden="true" />
                      Ampliar imagem
                    </Button>
                    <Button size="sm" variant="ghost" disabled>
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      Nova evidência
                    </Button>
                  </div>
                }
              >
                {data.evidence ? (
                  <figure>
                    <div className="kirvra-map-grid relative flex h-[240px] items-center justify-center overflow-hidden rounded-md border border-border">
                      <span className="text-xs text-muted-foreground">
                        Frame protegido · carregado por URL assinada de curta
                        duração (integração pendente)
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute top-[28%] left-[38%] h-[38%] w-[26%] rounded border-2 border-critical"
                      />
                      <span className="absolute top-[22%] left-[38%] rounded bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-critical-foreground">
                        {data.evidence.boundingBoxLabel}
                      </span>
                    </div>
                    <figcaption className="tabular mt-2 text-xs text-muted-foreground">
                      Confiança do modelo{" "}
                      {Math.round(data.evidence.confidence * 100)}% ·{" "}
                      {formatTime(data.evidence.capturedAt)} · visualização
                      registrada em auditoria
                    </figcaption>
                  </figure>
                ) : (
                  <EmptyState description="Nenhuma evidência visual anexada a este alerta." />
                )}
              </Panel>

              <Panel
                title="Áudio e transcrição"
                description={
                  data.audio
                    ? `Duração ${data.audio.durationSeconds}s`
                    : "Sem áudio anexado"
                }
              >
                {data.audio ? (
                  <>
                    <div
                      className="flex h-20 items-end gap-[2px] rounded-md border border-border bg-surface px-2 py-2"
                      role="img"
                      aria-label="Forma de onda do áudio capturado"
                    >
                      {data.audio.waveform.map((value, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-sm bg-primary/70"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <Button size="sm" variant="outline">
                        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Ouvir áudio
                      </Button>
                      <div className="flex min-w-[180px] flex-1 items-center gap-3">
                        <Label htmlFor="volume" className="text-xs">
                          Volume
                        </Label>
                        <Slider
                          id="volume"
                          value={volume}
                          onValueChange={setVolume}
                          max={100}
                          step={5}
                        />
                        <span className="tabular text-xs text-muted-foreground">
                          {volume[0]}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                {data.transcript ? (
                  <div className="mt-4 rounded-md border border-border bg-surface px-3 py-3">
                    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Transcrição
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {data.transcript.text}
                    </p>
                    <p className="mt-3 flex flex-wrap gap-1.5">
                      {data.transcript.riskWords.map((word) => (
                        <StatusBadge key={word} tone="critical" dot={false}>
                          {word}
                        </StatusBadge>
                      ))}
                    </p>
                  </div>
                ) : null}
              </Panel>
            </div>

            <div className="flex flex-col gap-4">
              <Panel title="Contexto do atendimento">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Motorista</dt>
                    <dd className="text-right">
                      <Link
                        to="/motoristas/$driverId"
                        params={{ driverId: data.driver.id } as any}
                        className="text-primary hover:underline"
                      >
                        {data.driver.displayName}
                      </Link>
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
                    <dt className="text-muted-foreground">Risk score</dt>
                    <dd className="tabular text-critical">
                      {data.alert.riskScore}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Operador responsável</dt>
                    <dd className="text-right text-foreground">
                      {data.alert.assignment.operatorName ?? "Sem responsável"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Em atendimento</dt>
                    <dd className="tabular text-foreground">
                      {formatClock(data.alert.handlingStartedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="tabular text-foreground">
                      {maskPhone(data.driver.phone)}
                    </dd>
                  </div>
                </dl>
              </Panel>

              <Panel
                title="Decisão humana"
                description="A IA nunca decide. Toda ação registra funcionário, horário e contexto."
                bodyClassName="grid gap-2 p-4"
              >
                <Button
                  variant="destructive"
                  disabled={data.readOnly}
                  onClick={() => setDialog("confirmar")}
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Confirmar ameaça
                </Button>
                <Button
                  disabled={data.readOnly}
                  onClick={() => setDialog("protocolo")}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Iniciar protocolo
                </Button>
                <Button
                  variant="outline"
                  disabled={data.readOnly}
                  onClick={() => setDialog("nota")}
                >
                  <NotebookPen className="h-4 w-4" aria-hidden="true" />
                  Adicionar nota
                </Button>
                <Button
                  variant="outline"
                  disabled={data.readOnly}
                  onClick={() => setDialog("falso")}
                >
                  <CircleSlash className="h-4 w-4" aria-hidden="true" />
                  Marcar falso positivo
                </Button>
                <Button
                  variant="secondary"
                  disabled={data.readOnly}
                  onClick={() => setDialog("encerrar")}
                >
                  <SquareCheck className="h-4 w-4" aria-hidden="true" />
                  Encerrar ocorrência
                </Button>
              </Panel>
            </div>
          </div>

          <ConfirmActionDialog
            open={dialog === "confirmar"}
            onOpenChange={(open) => setDialog(open ? "confirmar" : null)}
            title="Confirmar ameaça"
            description="Confirmação explícita da ameaça pelo operador. A decisão fica registrada em auditoria com seu identificador."
            confirmLabel="Confirmar ameaça"
            destructive
            reasonLabel="Fundamentação da confirmação"
            reasonPlaceholder="Descreva o que foi observado na evidência e no áudio"
            onConfirm={async (notes) => report(await confirmThreat(alertId, notes))}
          />

          <ConfirmActionDialog
            open={dialog === "protocolo"}
            onOpenChange={(open) => setDialog(open ? "protocolo" : null)}
            title="Iniciar protocolo de emergência"
            description="Aciona o protocolo de resposta desta ocorrência. A ação é irreversível e auditada."
            confirmLabel="Iniciar protocolo"
            destructive
            onConfirm={async () => report(await startProtocol(alertId))}
          />

          <ConfirmActionDialog
            open={dialog === "nota"}
            onOpenChange={(open) => setDialog(open ? "nota" : null)}
            title="Adicionar nota ao atendimento"
            description="A nota entra na linha do tempo do protocolo."
            confirmLabel="Salvar nota"
            reasonLabel="Nota"
            onConfirm={async (note) => report(await addAlertNote(alertId, note))}
          />

          <ConfirmActionDialog
            open={dialog === "falso"}
            onOpenChange={(open) => setDialog(open ? "falso" : null)}
            title="Marcar como falso positivo"
            description="O motivo é obrigatório e alimenta a revisão do KIRVRA AI Engine."
            confirmLabel="Marcar falso positivo"
            reasonLabel="Motivo"
            reasonPlaceholder="Explique por que não houve ameaça real"
            onConfirm={async (reason) =>
              report(await markFalsePositive(alertId, reason))
            }
          />

          <ConfirmActionDialog
            open={dialog === "encerrar"}
            onOpenChange={(open) => setDialog(open ? "encerrar" : null)}
            title="Encerrar ocorrência"
            description="Registre o resultado final e a observação de encerramento."
            confirmLabel="Encerrar ocorrência"
            reasonLabel="Resultado e observação"
            reasonPlaceholder="Resultado da ocorrência e observações finais"
            onConfirm={async (notes) =>
              report(await closeAlert(alertId, notes.slice(0, 40), notes))
            }
          />

          <ConfirmActionDialog
            open={dialog === "transferir"}
            onOpenChange={(open) => setDialog(open ? "transferir" : null)}
            title="Transferir atendimento"
            description="Selecione o operador que assumirá este protocolo."
            confirmLabel="Transferir"
            extraFields={
              <div className="space-y-1.5">
                <Label htmlFor="transfer-target">Operador de destino</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger id="transfer-target">
                    <SelectValue placeholder="Selecione o operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators
                      .filter((o) => o.role === "operador")
                      .map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            }
            onConfirm={async () => report(await transferAlert(alertId, target))}
          />

          <ConfirmActionDialog
            open={dialog === "escalar"}
            onOpenChange={(open) => setDialog(open ? "escalar" : null)}
            title="Escalar ao supervisor"
            description="Selecione o supervisor responsável pela escalada."
            confirmLabel="Escalar"
            destructive
            extraFields={
              <div className="space-y-1.5">
                <Label htmlFor="escalate-target">Supervisor</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger id="escalate-target">
                    <SelectValue placeholder="Selecione o supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators
                      .filter(
                        (o) => o.role === "supervisor" || o.role === "gerente",
                      )
                      .map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            }
            onConfirm={async () => report(await escalateAlert(alertId, target))}
          />
        </>
      ) : null}
    </KirvraAppShell>
  );
}
