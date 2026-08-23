import { useState, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, Eye, FileAudio, FileVideo, Info, RefreshCw, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { FilterBar, FilterField, OperationalTable } from "@/components/kirvra/data-display";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge,
  DriverAvatar,
} from "@/components/kirvra/primitives";
import { formatDateTime, formatElapsed } from "@/lib/kirvra-format";
import {
  listEvidence,
  getEvidenceSignedUrl,
  getEvidenceStats,
  getEvidenceTypes,
  DEFAULT_EVIDENCE_FILTERS,
  type EvidenceFilters,
  type EvidenceRow,
} from "@/services/evidence-service";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_central/evidencias")({
  component: () => (
    <RequirePermission permissions={["evidence.view"]}>
      <EvidenciasPage />
    </RequirePermission>
  ),
});

function EvidenceDetailsDialog({
  evidence,
  open,
  onOpenChange,
}: {
  evidence: EvidenceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlStatus, setUrlStatus] = useState<"available" | "error" | "missing" | "idle">("idle");
  const [loadingUrl, setLoadingUrl] = useState(false);

  const canView = useMemo(() => {
    if (!evidence) return false;
    if (evidence.mime_type?.startsWith("image/")) return can("evidence.image");
    if (evidence.mime_type?.startsWith("audio/")) return can("evidence.audio");
    if (evidence.mime_type?.startsWith("video/")) return true; // Supondo permissão base para vídeo ou evidence.view
    return true;
  }, [evidence, can]);

  const loadUrl = async () => {
    if (!evidence || !evidence.storage_path) return;
    setLoadingUrl(true);
    try {
      const result = await getEvidenceSignedUrl(
        evidence.storage_bucket || "alert-evidence",
        evidence.storage_path,
      );
      setSignedUrl(result.url);
      setUrlStatus(result.status);
      if (result.status !== "available") {
        toast.error(
          result.status === "missing" ? "Arquivo não vinculado." : "Erro ao gerar URL segura.",
        );
      }
    } catch (error) {
      setUrlStatus("error");
      toast.error("Erro ao gerar URL segura.");
    } finally {
      setLoadingUrl(false);
    }
  };

  const reset = () => {
    setSignedUrl(null);
    setUrlStatus("idle");
    setLoadingUrl(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  if (!evidence) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Detalhes da Evidência</DialogTitle>
          <DialogDescription>
            {evidence.id} · Capturada em {formatDateTime(evidence.captured_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Panel title="Visualização" bodyClassName="p-0">
              <div className="flex aspect-video items-center justify-center bg-muted/20">
                {!canView ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-critical">
                      Sem permissão para visualizar este tipo de mídia.
                    </p>
                  </div>
                ) : signedUrl ? (
                  evidence.mime_type?.startsWith("image/") ? (
                    <img src={signedUrl} alt="Evidência" className="h-full w-full object-contain" />
                  ) : evidence.mime_type?.startsWith("video/") ? (
                    <video src={signedUrl} controls className="h-full w-full" />
                  ) : evidence.mime_type?.startsWith("audio/") ? (
                    <audio src={signedUrl} controls className="w-full px-4" />
                  ) : (
                    <div className="p-4 text-center">
                      <Button asChild variant="outline">
                        <a href={signedUrl} download={`evidencia-${evidence.id}`}>
                          <Download className="mr-2 h-4 w-4" />
                          Baixar Arquivo
                        </a>
                      </Button>
                    </div>
                  )
                ) : (
                  <Button onClick={loadUrl} disabled={loadingUrl}>
                    {loadingUrl ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Gerar URL assinada
                  </Button>
                )}
              </div>
            </Panel>

            <Panel title="Metadados">
              <div className="space-y-2 text-xs">
                {evidence.metadata ? (
                  Object.entries(evidence.metadata).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between border-b border-border/50 py-1 last:border-0"
                    >
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium text-foreground">{String(v)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Nenhum metadado disponível.</p>
                )}
                {evidence.sha256 && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                    <span className="text-muted-foreground">SHA256 Integrity</span>
                    <span className="break-all font-mono text-[10px] text-foreground">
                      {evidence.sha256}
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel title="Vínculos Operacionais">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Motorista</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {evidence.driver_name ? (
                      <>
                        <DriverAvatar initials={evidence.driver_name.slice(0, 2)} size="sm" />
                        <Link
                          to="/motoristas/$driverId"
                          params={{ driverId: evidence.driver_id || "" }}
                          className="font-medium text-primary hover:underline"
                        >
                          {evidence.driver_name}
                        </Link>
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sessão</dt>
                  <dd className="mt-1">
                    {evidence.session_id ? (
                      <Link
                        to="/sessoes/$sessionId"
                        params={{ sessionId: evidence.session_id || "" }}
                        className="text-primary hover:underline"
                      >
                        {evidence.session_label || evidence.session_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Alerta Relacionado</dt>
                  <dd className="mt-1">
                    {evidence.alert_id || evidence.security_alert_id ? (
                      <Link
                        to="/alertas/$alertId"
                        params={{ alertId: evidence.alert_id || evidence.security_alert_id || "" }}
                        className="text-primary hover:underline"
                      >
                        {evidence.alert_id
                          ? `ID ${evidence.alert_id.slice(0, 8)}`
                          : `IA ${evidence.security_alert_id?.slice(0, 8)}`}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Origem do Alerta</dt>
                  <dd className="mt-1">
                    <StatusBadge
                      tone={evidence.alert_origin === "IA" ? "critical" : "neutral"}
                      dot={false}
                    >
                      {evidence.alert_origin === "IA" ? "KIRVRA AI Engine" : "Alerta Comum"}
                    </StatusBadge>
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Informações do Arquivo">
              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Tipo MIME</dt>
                  <dd className="font-medium">{evidence.mime_type || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tamanho</dt>
                  <dd className="font-medium">
                    {evidence.size_bytes
                      ? `${(evidence.size_bytes / 1024 / 1024).toFixed(2)} MB`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bucket</dt>
                  <dd className="font-medium">{evidence.storage_bucket || "alert-evidence"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {urlStatus === "available" ? (
                      <StatusBadge tone="success">Disponível</StatusBadge>
                    ) : urlStatus === "missing" ? (
                      <StatusBadge tone="neutral">Sem Arquivo</StatusBadge>
                    ) : urlStatus === "error" ? (
                      <StatusBadge tone="critical">Indisponível</StatusBadge>
                    ) : (
                      <span className="text-muted-foreground italic">Pendente</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EvidenciasPage() {
  const [filters, setFilters] = useState<EvidenceFilters>(DEFAULT_EVIDENCE_FILTERS);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["evidences", filters],
    queryFn: () => listEvidence(filters),
  });

  const { data: evidenceStats } = useQuery({
    queryKey: ["evidence-stats"],
    queryFn: () => getEvidenceStats(),
  });

  const { data: evidenceTypes } = useQuery({
    queryKey: ["evidence-types"],
    queryFn: () => getEvidenceTypes(),
  });

  const handleOpenDetails = (evidence: EvidenceRow) => {
    setSelectedEvidence(evidence);
    setDetailsOpen(true);
  };

  const stats = useMemo(() => {
    return {
      total: evidenceStats?.total || 0,
      images: evidenceStats?.images || 0,
      media: evidenceStats?.media || 0,
      recent24h: evidenceStats?.recent24h || 0,
    };
  }, [evidenceStats]);

  return (
    <KirvraAppShell title="Evidências">
      <PageHeader
        title="Evidências"
        description="Biblioteca protegida. Imagens, áudios, vídeos e transcrições vinculados aos alertas."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total de Evidências" value={String(stats.total)} />
        <MetricCard label="Imagens" value={String(stats.images)} tone="primary" />
        <MetricCard label="Áudios / Vídeos" value={String(stats.media)} tone="warning" />
        <MetricCard label="Últimas 24 horas" value={String(stats.recent24h)} tone="success" />
      </div>

      <FilterBar>
        <FilterField label="Busca" htmlFor="search">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="ID, motorista ou alerta"
              className="pl-8"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
        </FilterField>

        <FilterField label="Tipo" htmlFor="type">
          <Select
            value={filters.type}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: v, page: 1 }))}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              {evidenceTypes?.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === "todos"
                    ? "Todos os tipos"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Origem" htmlFor="origin">
          <Select
            value={filters.origin}
            onValueChange={(v) => setFilters((f) => ({ ...f, origin: v, page: 1 }))}
          >
            <SelectTrigger id="origin">
              <SelectValue placeholder="Todas as origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              <SelectItem value="IA">IA Engine</SelectItem>
              <SelectItem value="Comum">Alerta Comum</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Período" htmlFor="period">
          <Select
            value={filters.period}
            onValueChange={(v) => setFilters((f) => ({ ...f, period: v, page: 1 }))}
          >
            <SelectTrigger id="period">
              <SelectValue placeholder="Últimos 30 dias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? (
        <ErrorState action={<Button onClick={() => void refetch()}>Tentar novamente</Button>} />
      ) : null}

      {!isLoading && !isError && data ? (
        <Panel bodyClassName="p-0">
          <OperationalTable<EvidenceRow>
            caption="Lista de evidências operacionais"
            rows={data.rows}
            rowKey={(row) => row.id}
            emptyState={
              <div className="p-8">
                <EmptyState description="Nenhuma evidência encontrada com estes filtros." />
              </div>
            }
            columns={[
              {
                key: "type",
                header: "Tipo",
                width: "80px",
                render: (row) => {
                  if (row.mime_type?.startsWith("image/"))
                    return <Camera className="h-4 w-4 text-primary" />;
                  if (row.mime_type?.startsWith("audio/"))
                    return <FileAudio className="h-4 w-4 text-warning" />;
                  if (row.mime_type?.startsWith("video/"))
                    return <FileVideo className="h-4 w-4 text-warning" />;
                  return <Info className="h-4 w-4 text-muted-foreground" />;
                },
              },
              {
                key: "captured",
                header: "Data e Hora",
                width: "180px",
                render: (row) => (
                  <span className="tabular text-xs">{formatDateTime(row.captured_at)}</span>
                ),
              },
              {
                key: "driver",
                header: "Motorista",
                render: (row) => (
                  <span className="flex items-center gap-2">
                    <DriverAvatar initials={row.driver_name?.slice(0, 2) || "—"} size="sm" />
                    <span className="truncate">{row.driver_name || "—"}</span>
                  </span>
                ),
              },
              {
                key: "session",
                header: "Sessão",
                render: (row) => (
                  <span className="text-xs text-muted-foreground truncate block max-w-[150px]">
                    {row.session_label || row.session_id || "—"}
                  </span>
                ),
              },
              {
                key: "alert",
                header: "Alerta",
                render: (row) => (
                  <span className="text-xs font-medium truncate">
                    {row.alert_id
                      ? row.alert_id.slice(0, 8)
                      : row.security_alert_id
                        ? `IA ${row.security_alert_id.slice(0, 8)}`
                        : "—"}
                  </span>
                ),
              },
              {
                key: "origin",
                header: "Origem",
                render: (row) => (
                  <StatusBadge
                    tone={row.alert_origin === "IA" ? "critical" : "neutral"}
                    dot={false}
                  >
                    {row.alert_origin === "IA" ? "IA" : "Comum"}
                  </StatusBadge>
                ),
              },
              {
                key: "mime",
                header: "MIME / Tamanho",
                render: (row) => (
                  <span className="text-[10px] text-muted-foreground">
                    {row.mime_type} ·{" "}
                    {row.size_bytes ? `${(row.size_bytes / 1024).toFixed(0)} KB` : "—"}
                  </span>
                ),
              },
              {
                key: "action",
                header: "Ação",
                align: "right",
                render: (row) => (
                  <Button size="sm" variant="outline" onClick={() => handleOpenDetails(row)}>
                    Visualizar detalhes
                  </Button>
                ),
              },
            ]}
          />

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Mostrando {data.rows.length} de {data.count} evidências
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page * filters.pageSize >= data.count}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <EvidenceDetailsDialog
        evidence={selectedEvidence}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </KirvraAppShell>
  );
}
