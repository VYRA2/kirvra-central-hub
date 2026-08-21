import { cn } from "@/lib/utils";

/**
 * Símbolo KIRVRA das referências visuais.
 * Ativo oficial da marca ainda pendente no repositório — este SVG é
 * temporário e não deve substituir o arquivo oficial quando ele chegar.
 */
export function KirvraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Símbolo KIRVRA"
      className={cn("h-8 w-8", className)}
    >
      <path
        d="M16 2.5 27 7.2v9.1c0 6.6-4.4 11.6-11 13.2-6.6-1.6-11-6.6-11-13.2V7.2L16 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 10.5v11M11.5 14.5 16 10.5l4.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KirvraWordmark({
  className,
  subtitle = "CENTRAL",
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <KirvraMark className="h-8 w-8 text-primary" />
      <div className="leading-tight">
        <span className="block text-sm font-semibold tracking-[0.22em] text-foreground">
          KIRVRA
        </span>
        <span className="block text-[10px] font-medium tracking-[0.34em] text-primary">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
