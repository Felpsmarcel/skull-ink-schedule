import { useId } from "react";
import { Banknote, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import type { MovimentacaoLinkAddress } from "@/lib/my-movimentacao-link";

export type PaymentLinkCardState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "no_link" }
  | { kind: "ready"; displayName: string; address: MovimentacaoLinkAddress };

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";

/** Presentation only: fixtures can render this without identity or network requests. */
export function PaymentLinkCardView({
  state,
  onCopy,
  onRetry,
}: {
  state: PaymentLinkCardState;
  onCopy: () => void;
  onRetry: () => void;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Banknote className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-semibold text-foreground">
            Link para registrar recebimentos
          </h2>
          {state.kind === "ready" && (
            <p className="mt-1 break-words text-sm text-muted-foreground">
              Vinculado a <span className="font-medium text-foreground">{state.displayName}</span>
            </p>
          )}
        </div>
      </div>

      {state.kind === "loading" && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Conferindo o vínculo desta conta…
        </p>
      )}
      {state.kind === "error" && (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-muted-foreground">
            Não foi possível consultar seu link. Tente novamente.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={`${actionClass} border border-border hover:bg-muted`}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}
      {state.kind === "no_link" && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Nenhum link pessoal configurado para esta conta. A administração pode conferir os vínculos
          da equipe.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          {state.address.isTest && (
            <div className="mt-4 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <p className="font-semibold">Link da prévia</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Endereço de prévia. O formulário pode registrar recebimentos reais.
              </p>
            </div>
          )}
          <details className="mt-4 text-sm text-muted-foreground">
            <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver endereço do formulário
            </summary>
            <p className="mt-2 break-all text-xs leading-relaxed">{state.address.url}</p>
          </details>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <button
              type="button"
              onClick={onCopy}
              className={`${actionClass} border border-border hover:bg-muted`}
            >
              <Copy className="size-4" aria-hidden="true" />
              {state.address.isTest ? "Copiar link da prévia" : "Copiar link"}
            </button>
            <a
              href={state.address.url}
              className={`${actionClass} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {state.address.isTest ? "Abrir prévia" : "Abrir formulário"}
            </a>
          </div>
        </>
      )}
    </section>
  );
}
