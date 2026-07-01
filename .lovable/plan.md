
# MVP — o que falta para lançar

Baseado no raio-x atual, o app já tem: auth (admin/artista), agenda dia/semana/mês ligada ao GHL, criação de agendamento com dual-write (GHL + Supabase), serviços no Supabase, financeiro com comissão, sync/reconciliação GHL, relatórios mensais. Para chamar de MVP publicável, faltam poucos itens críticos.

## Escopo do MVP (o mínimo para ir ao ar)

### 1. Onboarding real dos usuários (bloqueador)
- Remover seeds de teste (já feito) e criar fluxo real:
  - Admin convida artista por email (Supabase invite) → artista define senha → linka `app_users.artist_id`.
  - Tela `/admin/equipe` (lista artistas + convidar + vincular `ghl_calendar_id`).
- Sem isso, só quem existe no seed consegue entrar.

### 2. Recuperação de senha (bloqueador legal/UX)
- Rota `/auth/recover` + template já existe (`recovery.tsx`) — falta ligar o botão "Esqueci a senha" em `/auth` e a rota de callback `update-password`.

### 3. Sync GHL agendado (bloqueador de confiabilidade)
- `pg_cron` chamando `/api/public/hooks/sync-ghl` a cada 10 min (endpoint já existe, falta o cron).
- Garante que Agenda/Financeiro continuam corretos se alguém editar direto no GHL.

### 4. Backfill inicial + validação dos dados
- Rodar "Backfill 12 meses" uma vez (botão já existe).
- Passar em `/reconciliar` e resolver o que sobrar (calendário sem artista, contato sem telefone, etc.).

### 5. Ajustes de produção
- `head()` do `__root.tsx`: título/description reais da GF Tattoo, og:image com o lockup (já temos asset).
- Remover rotas de debug: `/agenda?debug=1`, `_admin/ghl-test`.
- Configurar domínio de email transacional (`email_domain`) — hoje envia do domínio padrão do Lovable.
- Rodar `security--run_security_scan` e resolver o que for crítico.

### 6. Documentação mínima para o cliente
- README curto em `/menu` (ou modal "Ajuda") com: como convidar artista, como sincronizar, como resolver reconciliação, como ver relatório.

## Fora do MVP (fica para v1.1)
- Pagamento real (Stripe/Paddle) — hoje é stub e o fluxo confirma sem cobrar; ok para MVP porque a cobrança acontece presencialmente no estúdio.
- Módulo de avaliações (`/reviews` é placeholder).
- Edição/cancelamento de agendamento pela UI (hoje só cria; edição continua no GHL).
- Push/notificações — GHL já dispara os lembretes por SMS/email.
- Drag-and-drop na agenda.

## Ordem sugerida de execução (sprints curtos)
1. **Sprint MVP-1 (bloqueadores):** onboarding de artista + recuperação de senha + cron de sync.
2. **Sprint MVP-2 (produção):** metadados/SEO, remoção de rotas debug, email transacional, security scan.
3. **Go-live:** backfill 12m + reconciliação + doc de ajuda + publicar.

## Perguntas antes de detalhar cada sprint
- **Onboarding:** admin convida por email (recomendado) ou você prefere criar artista + senha manualmente no `/admin/equipe`?
- **Email transacional:** quer configurar domínio próprio (`no-reply@gftattoo.be`) agora ou deixa o domínio padrão do Lovable no MVP?
- **Rotas debug:** posso deletar `/_admin/ghl-test` e o `?debug=1` da agenda, ou prefere mantê-las escondidas atrás de flag?

Responda essas 3 e eu abro o plano detalhado da Sprint MVP-1 para você aprovar.
