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
    "Ferramentas do GF Tattoo Studio. `list_appointments`, `list_movimentacoes` e `resumo_financeiro` leem o CRM (HighLevel) ao vivo: a agenda vem dos calendários e o financeiro das oportunidades (valor, status, pipeline, tatuador atribuído). `list_artists` lê a lista de tatuadores e comissões do aplicativo. Tudo respeita as permissões do utilizador autenticado: admin vê tudo, tatuador vê apenas o seu.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAppointments, listMovimentacoes, resumoFinanceiro, listArtists],
});
