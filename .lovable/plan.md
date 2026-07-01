## Objetivo
Padronizar todos os metadados para "GF Tattoo Studio" e apontar canônicos/OG para o novo domínio **https://gftattoocalendar.com**. Os títulos das rotas já estão corretos — o foco é limpar strings residuais, adicionar descrições por rota e alinhar canonical/og:url ao domínio comprado.

> Se o domínio comprado for outro (ex.: `.info` em vez de `.com`), me avise antes de eu implementar — troco a constante `SITE_URL` em um único lugar.

## 1. Root shell (`src/routes/__root.tsx`)
- Manter `title` "GF Tattoo Studio" e `description` "Estúdio de tatuagem — agendamento online".
- **Remover** `og:image` e `twitter:image` do root (o guia manda `og:image` só em rotas folha; deixar hosting injetar o preview padrão).
- Adicionar `og:site_name` (já existe) e manter `og:type: website` como default.

## 2. Descrições e OG por rota
Adicionar `description`, `og:title`, `og:description` e `og:url` (absoluto em `https://gftattoocalendar.com/...`) + `<link rel="canonical">` nas rotas folha:

| Rota | Título (já ok) | Descrição nova |
|---|---|---|
| `/` | GF Tattoo Studio | Estúdio de tatuagem em Bruxelas — agende online. |
| `/auth` | Entrar | Acesse sua conta no GF Tattoo Studio. |
| `/auth_/recover` | Recuperar senha | Recupere o acesso à sua conta. |
| `/auth_/update-password` | Definir senha | Defina uma nova senha de acesso. |
| `/agenda` | Agenda | Sua agenda de atendimentos no GF Tattoo Studio. |
| `/services` | Serviços | Catálogo de serviços do GF Tattoo Studio. |
| `/appointments/new` | Novo agendamento | Inicie um novo agendamento. |
| `/appointments/new/services` | Selecionar serviço | Escolha o serviço para o agendamento. |
| `/appointments/new/checkout` | Revisar agendamento | Revise e confirme o agendamento. |
| `/menu` | Menu | Menu do GF Tattoo Studio. |
| `/reviews` | Avaliações | Feedback dos clientes do GF Tattoo Studio. |
| `/financeiro` | Financeiro | Painel financeiro do GF Tattoo Studio. |
| `/admin/equipe` | Equipe | Gestão da equipe do GF Tattoo Studio. |
| `/admin/relatorios/agendamentos` | Relatório mensal | Relatório mensal de agendamentos. |
| `/admin/reconciliar` | Reconciliar GHL | Reconciliação de sincronizações. |
| `/admin/ghl-test` | GHL Test | Diagnóstico da integração GHL. |

Rotas admin/authenticated recebem também `<meta name="robots" content="noindex,nofollow">`.

## 3. Strings residuais fora de metadata
Trocar rótulos de remetente/label que ainda dizem "app-gftattoo-schedule" ou "skull-ink-schedule" para "GF Tattoo Studio":
- `src/routes/api/public/hooks/send-reminders.ts` — `SITE_NAME = 'GF Tattoo Studio'`.
- `src/routes/lovable/email/auth/preview.ts` — `SAMPLE_PROJECT_URL = 'https://gftattoocalendar.com'`.
- `src/lib/team.functions.ts` — `from: "GF Tattoo Studio <noreply@notify.gftattooacademy.info>"` (mantém domínio de envio, corrige nome).

O domínio de envio de e-mail (`notify.gftattooacademy.info`) NÃO muda — ele é independente do domínio do site e já está configurado no provedor.

## 4. Favicon
Já aponta para `gf-mark.png` em `__root.tsx` via `gfMarkUrl`. Sem mudança — apenas confirmar após deploy.

## Observações técnicas
- Canonical fica só nas rotas folha (evita duplicar por concatenação de `links` no root).
- Uso `https://gftattoocalendar.com` como base URL fixa (o domínio `www` redireciona para apex conforme configuração do hosting).
- Nenhuma migration ou mudança de backend; só edição de rotas + 3 constantes.
- Depois do deploy, refresh do preview no Facebook/LinkedIn debugger é opcional para forçar recache do OG.
