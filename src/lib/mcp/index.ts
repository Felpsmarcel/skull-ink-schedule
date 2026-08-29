import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAppointments from "./tools/list-appointments";
import listMovimentacoes from "./tools/list-movimentacoes";
import listArtists from "./tools/list-artists";
import resumoFinanceiro from "./tools/resumo-financeiro";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "gf-tattoo-studio",
  title: "GF TATTOO STUDIO",
  version: "0.1.0",
  instructions:
    "Ferramentas do GF Tattoo Studio. Use `list_appointments` para a agenda, `list_movimentacoes` e `resumo_financeiro` para pagamentos registados, e `list_artists` para os tatuadores. Todos os dados respeitam as permissões do utilizador autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAppointments, listMovimentacoes, resumoFinanceiro, listArtists],
});
