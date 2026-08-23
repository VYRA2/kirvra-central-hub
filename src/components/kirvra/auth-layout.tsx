import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { KirvraMark } from "./brand";

/**
 * Moldura institucional das telas de acesso (referências 01 e 02).
 * Painel institucional à esquerda, cartão de ação à direita.
 */
export function KirvraAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_460px] lg:px-12">
        <section className="max-w-xl">
          <div className="flex items-center gap-3">
            <KirvraMark className="h-10 w-10 text-primary" />
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-[0.24em] text-foreground">KIRVRA</p>
              <p className="text-xs font-medium tracking-[0.38em] text-primary">CENTRAL</p>
            </div>
          </div>

          <h1 className="mt-10 text-4xl leading-tight font-semibold text-foreground">
            Proteção inteligente.
            <br />
            <span className="text-primary">Resposta humana.</span>
          </h1>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Ambiente operacional restrito da Central KIRVRA. Aqui a equipe acompanha sessões
            protegidas em tempo real, analisa evidências enviadas pelo aplicativo KIRVRA Drive e
            pelo KIRVRA AI Engine e atende alertas de segurança com decisão humana.
          </p>

          <ul className="mt-8 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              Monitoramento contínuo de motoristas protegidos
            </li>
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              Análise humana de imagem, áudio e transcrição
            </li>
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              Protocolos de resposta com registro de auditoria
            </li>
          </ul>

          <p className="mt-10 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Acesso restrito · Todas as ações são auditadas
          </p>
        </section>

        <section className="w-full">{children}</section>
      </div>
    </div>
  );
}
