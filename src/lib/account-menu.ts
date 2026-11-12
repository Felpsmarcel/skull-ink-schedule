import type { MyProfile } from "@/lib/auth.functions";

export type AccountIcon =
  | "queue"
  | "checkin"
  | "report"
  | "wallet"
  | "receipt"
  | "links"
  | "artists"
  | "sellers"
  | "settings"
  | "reconcile"
  | "health"
  | "assistant"
  | "projects";
export interface AccountMenuItem {
  to: string;
  label: string;
  description: string;
  icon: AccountIcon;
}
export interface AccountMenuSection {
  id: string;
  title: string;
  description: string;
  items: AccountMenuItem[];
}

/** Navigation only. Each destination retains its own server authorization. */
export function getAccountMenu(profile: MyProfile | null | undefined): AccountMenuSection[] {
  if (profile?.role === "admin") {
    return [
      {
        id: "reception",
        title: "Recepção",
        description: "Da chegada ao atendimento.",
        items: [
          {
            to: "/admin/fila",
            label: "Fila do dia",
            description: "Acompanhar chegadas e atendimentos.",
            icon: "queue",
          },
          {
            to: "/totem",
            label: "Totem de check-in",
            description: "Abrir a tela de chegada dos clientes.",
            icon: "checkin",
          },
          {
            to: "/relatorios/agendamentos",
            label: "Relatório de agendamentos",
            description: "Consultar a agenda por mês.",
            icon: "report",
          },
        ],
      },
      {
        id: "finance",
        title: "Financeiro",
        description: "Valores e registros do estúdio.",
        items: [
          {
            to: "/financeiro",
            label: "Financeiro do estúdio",
            description: "Consultar valores e comissões.",
            icon: "wallet",
          },
          {
            to: "/admin/movimentacao/novo",
            label: "Registrar recebimento",
            description: "Informar valor, cliente e responsável.",
            icon: "receipt",
          },
          {
            to: "/relatorios/movimentacoes",
            label: "Relatório de recebimentos",
            description: "Revisar os lançamentos registrados.",
            icon: "report",
          },
          {
            to: "/admin/movimentacao-links",
            label: "Links da equipe",
            description: "Escolher de quem é o link de registro.",
            icon: "links",
          },
        ],
      },
      {
        id: "team",
        title: "Equipe e acessos",
        description: "As pessoas que fazem o estúdio.",
        items: [
          {
            to: "/admin/equipe",
            label: "Tatuadores",
            description: "Consultar a equipe e seus vínculos.",
            icon: "artists",
          },
          {
            to: "/admin/vendedores",
            label: "Vendedores",
            description: "Gerenciar a equipe comercial.",
            icon: "sellers",
          },
          {
            to: "/admin/configuracoes",
            label: "Configurações do estúdio",
            description: "Consultar e ajustar as configurações.",
            icon: "settings",
          },
        ],
      },
      {
        id: "integrations",
        title: "Integrações",
        description: "Conexões e pendências para revisar.",
        items: [
          {
            to: "/reconciliar",
            label: "Conciliar com o GHL",
            description: "Revisar divergências nos registros.",
            icon: "reconcile",
          },
          {
            to: "/admin/saude",
            label: "Incidentes e sincronização",
            description: "Abrir o diagnóstico da operação.",
            icon: "health",
          },
          {
            to: "/connect",
            label: "Configurar assistente",
            description: "Ver instruções para conectar uma ferramenta de IA.",
            icon: "assistant",
          },
        ],
      },
    ];
  }
  if (profile?.role === "artist" && profile.artistId) {
    return [
      {
        id: "work",
        title: "Meu trabalho",
        description: "A continuidade de cada projeto.",
        items: [
          {
            to: "/projetos",
            label: "Meus projetos",
            description: "Consultar projetos, sessões e fotos disponíveis.",
            icon: "projects",
          },
        ],
      },
      {
        id: "finance",
        title: "Meus valores",
        description: "Consulte os registros da sua conta.",
        items: [
          {
            to: "/financeiro",
            label: "Meus repasses",
            description: "Acompanhar os valores das suas sessões.",
            icon: "wallet",
          },
          {
            to: "/relatorios/movimentacoes",
            label: "Meus recebimentos",
            description: "Consultar valores registrados como recebidos por você.",
            icon: "receipt",
          },
        ],
      },
      {
        id: "tools",
        title: "Ferramentas",
        description: "Conexões para o seu trabalho.",
        items: [
          {
            to: "/connect",
            label: "Configurar assistente",
            description: "Ver instruções e requisitos para conectar uma ferramenta de IA.",
            icon: "assistant",
          },
        ],
      },
    ];
  }
  if (profile?.role === "seller" && profile.sellerId) {
    return [
      {
        id: "finance",
        title: "Minha carteira",
        description: "Seus valores e registros comerciais.",
        items: [
          {
            to: "/financeiro",
            label: "Minhas comissões",
            description: "Consultar os valores atribuídos à sua carteira.",
            icon: "wallet",
          },
          {
            to: "/relatorios/movimentacoes",
            label: "Meus recebimentos",
            description: "Consultar valores registrados como recebidos por você.",
            icon: "receipt",
          },
        ],
      },
    ];
  }
  return [];
}

export function accountRoleLabel(profile: MyProfile): string {
  if (profile.role === "admin") return "Administrador";
  if (profile.role === "artist") return "Tatuador";
  if (profile.role === "seller") return "Vendedor";
  return "Acesso não identificado";
}
