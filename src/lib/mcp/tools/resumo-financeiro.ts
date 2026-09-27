import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveScope } from "../scope";
import { fetchCrmFinance, summarizeCrmFinance } from "../crm";
import { fetchStudioPayments, type StudioPaymentsSummary } from "../payments";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro (CRM + pagamentos reais)",
  description:
    "Resume o financeiro num intervalo de datas: oportunidades do CRM (ganho, em aberto, perdido) e o saldo de pagamentos reais registados no estúdio, com quebra por forma de pagamento e por tatuador.",
  inputSchema: {
    from: z.string().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().describe("Data final inclusiva (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    try {
      const scope = await resolveScope(ctx);
      if (scope.role === "seller") {
        return {
          content: [
            {
              type: "text",
              text: "Os vendedores não têm correspondência no CRM para dados financeiros. Consulta o relatório de lançamentos no aplicativo.",
            },
          ],
          isError: true,
        };
      }

      const artistNamesById = new Map(scope.artists.map((a) => [a.id, a.name] as const));

      // Pagamentos reais registados no estúdio — sempre disponíveis.
      let pagamentos: StudioPaymentsSummary | null = null;
      let pagamentosErro: string | null = null;
      try {
        pagamentos = await fetchStudioPayments(
          ctx,
          from,
          to,
          artistNamesById,
          scope.role === "artist" ? scope.artistId : null,
        );
      } catch (e) {
        pagamentosErro = e instanceof Error ? e.message : String(e);
      }

      // Oportunidades do CRM — exigem ligação ao utilizador do CRM.
      let crm: ReturnType<typeof summarizeCrmFinance> | null = null;
      let crmErro: string | null = null;
      if (scope.role === "artist" && !scope.restrictToGhlUserId) {
        crmErro = "Este tatuador ainda não está ligado a um utilizador do CRM.";
      } else {
        try {
          const { rows, truncated } = await fetchCrmFinance(
            from,
            to,
            scope.artistsByUserId,
            scope.restrictToGhlUserId,
          );
          crm = summarizeCrmFinance(rows, from, to, truncated);
        } catch (e) {
          crmErro = e instanceof Error ? e.message : String(e);
        }
      }

      if (!crm && !pagamentos) {
        return {
          content: [
            {
              type: "text",
              text: `Sem dados financeiros: CRM — ${crmErro ?? "indisponível"}; pagamentos — ${pagamentosErro ?? "indisponível"}.`,
            },
          ],
          isError: true,
        };
      }

      const recebido = pagamentos?.total_recebido_eur ?? 0;
      const ganhoCrm = crm?.total_ganho_eur ?? 0;

      const payload = {
        periodo: { from, to },
        saldo: {
          recebido_estudio_eur: recebido,
          ganho_no_crm_eur: ganhoCrm,
          em_aberto_no_crm_eur: crm?.total_aberto_eur ?? 0,
          diferenca_crm_menos_recebido_eur: round2(ganhoCrm - recebido),
        },
        pagamentos_reais: pagamentos,
        crm_oportunidades: crm,
        avisos: [
          crmErro ? `CRM: ${crmErro}` : null,
          pagamentosErro ? `Pagamentos do estúdio: ${pagamentosErro}` : null,
          "O CRM não expõe registos de pagamento ao token atual; o saldo recebido vem dos lançamentos do estúdio, e o CRM contribui apenas com oportunidades.",
        ].filter((v): v is string => Boolean(v)),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Falha ao montar o resumo financeiro: ${message}` }],
        isError: true,
      };
    }
  },
});
