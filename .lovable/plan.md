# Plano Estratégico de Correção — GF Tattoo Studio

> Documento de planejamento técnico. Nenhum código alterado nesta etapa.

---

## 1. Inventário priorizado de pendências

Resumo dos achados da auditoria funcional convertidos em itens executáveis. Ordem reflete dependências e risco, não cronologia final (o roadmap por Sprints está mais abaixo).

### P0 — Quebras críticas (bloqueiam fluxos principais)

#### P0.1 — Fluxo de novo agendamento (3 telas) não funciona via URL
- **Gravidade**: Crítica
- **Impacto p/ usuário**: ao navegar para `/appointments/new/services` ou `/checkout`, a UI fica congelada na tela pai. Fluxo de 3 passos não existe na prática.
- **Impacto técnico**: `src/routes/_authenticated/appointments.new.tsx` não renderiza `<Outlet />`. As rotas filhas casam o path mas nada aparece.
- **Dependências**: nenhuma; isolado ao módulo `appointments.new.*`.
- **Risco de regressão**: médio — qualquer mexida no parent toca toda a tela de booking.
- **Tempo estimado**: 4–6 h.
- **Complexidade**: Média.

#### P0.2 — Guard `_admin` bloqueia o próprio admin
- **Gravidade**: Crítica
- **Impacto p/ usuário**: admin perde acesso a `/ghl-test` (e qualquer rota futura sob `_admin`). Em hard refresh pode acontecer em outras rotas também.
- **Impacto técnico**: `beforeLoad` chama `requireAdmin` (serverFn) numa transição em que o bearer do `auth-attacher` pode ainda não estar pronto → 401 → catch redireciona para `/agenda`.
- **Dependências**: depende de `useCurrentUser` e do middleware `attachSupabaseAuth` já registrados.
- **Risco de regressão**: baixo (mudança contida no guard).
- **Tempo estimado**: 2–3 h.
- **Complexidade**: Baixa.

#### P0.3 — Hydration mismatch crônico em `/auth`
- **Gravidade**: Alta
- **Impacto p/ usuário**: flash visual no login, árvore React regenerada, logs poluídos escondendo erros reais.
- **Impacto técnico**: rota `ssr:false` mas o shell SSR renderiza `<Suspense>` enquanto o cliente entrega `<div>` no root do `AuthPage`.
- **Dependências**: nenhuma.
- **Risco de regressão**: baixo.
- **Tempo estimado**: 1–2 h.
- **Complexidade**: Baixa.

### P1 — Funcional, mas com bugs ou stubs visíveis

#### P1.1 — Botões `Save` / `Checkout` habilitados sem draft válido
- Permite clicar e disparar `finalizeAppointment` sem cliente/artista/serviço → erro 4xx/5xx ao usuário.
- Tempo: 1–2 h. Complexidade: Baixa. Sem dependências.

#### P1.2 — Bottom nav com 3 botões "comingSoon" (Services/Reviews/Menu)
- Não existem as rotas-destino. Usuário só vê toast.
- Tempo: depende do escopo (ver opções). Complexidade: Média.

#### P1.3 — i18n inconsistente (labels em EN, header de data em EN, locale errado)
- Algumas chaves rendem traduzidas, outras não; `toLocaleDateString` sem locale.
- Tempo: 3–4 h. Complexidade: Média. Risco de regressão baixo se for incremental.

#### P1.4 — Agenda sem estado vazio explicado e contadores sempre zerados
- UI não distingue "GHL falhou" de "dia sem expediente" de "dia realmente vazio".
- Tempo: 2–3 h. Complexidade: Baixa.

#### P1.5 — Bucket de pagamento divergente entre Admin e Artist
- Mesma `appointment` aparece `PAGO` no Admin e `PENDENTE` no Artist. Origem: `deriveBucket` no branch Artist não cruza com `payments`.
- Tempo: 2 h. Complexidade: Baixa. Risco de regressão médio (mexe em finance.functions).

#### P1.6 — Dados demo do financeiro poluindo totais
- 3 appointments seed (Cliente A/B/C) persistidos no banco aparecem como receita real.
- Tempo: 30 min (migration de limpeza) + decidir estratégia de seed para dev.
- Complexidade: Baixa.

### P2 — Funcionalidades parciais / qualidade

#### P2.1 — E-mails de auth scaffold sem integração real
- Templates existem em `src/lib/email-templates/*` mas Supabase Auth não está apontado para o webhook. "Esqueci a senha" não funciona.
- Tempo: 3–4 h. Complexidade: Média. Dependência: domínio `notify.gftattooacademy.info` (já configurado).

#### P2.2 — Sem tela "Esqueci a senha" / sem fluxo de recuperação
- Tempo: 2 h. Complexidade: Baixa. Depende de P2.1.

#### P2.3 — Recurrence e overflow `⋯` desabilitados
- Stubs visíveis. Decidir entre esconder ou implementar.
- Tempo: 1 h (esconder) ou 6–10 h (implementar recorrência real). Complexidade: Baixa/Alta.

#### P2.4 — Sincronização GHL → Supabase (mirror) não implementada
- Prometido em planos anteriores. Agenda hoje só lê GHL em tempo real (sem cache de resiliência).
- Tempo: 8–12 h. Complexidade: Média–Alta.

#### P2.5 — Sem feedback de erro padronizado e sem captura centralizada
- Existe `error-capture.ts` no server, mas o client não reporta erros para nenhum lugar.
- Tempo: 2–3 h. Complexidade: Baixa.

---

## 2. Decisões com mais de uma opção

### Decisão A — Como consertar o fluxo de novo agendamento (P0.1)

**Opção A1 — Adicionar `<Outlet />` no parent e mover form para `appointments.new.index.tsx`**
- Vantagens: usa convenções TanStack Router; deep-link funciona; cada passo tem URL própria; bom para back/forward do navegador.
- Desvantagens: requer reestruturar 3 arquivos; risco médio de quebrar imports/header compartilhado.
- Impacto futuro: cada passo evolui isolado; fácil adicionar passo 4 (ex.: pagamento).
- Escalabilidade: alta — padrão idiomático.
- Manutenção: fácil — quem chegar entende imediatamente.

**Opção A2 — Converter em wizard de estado interno (uma rota só), removendo `services`/`checkout` como rotas**
- Vantagens: menos arquivos; estado vive no Zustand draft que já existe; sem risco de URL fora de sincronia.
- Desvantagens: perde deep-link (impossível compartilhar URL do passo 2); back do navegador não navega entre passos.
- Impacto futuro: dificulta analytics por passo; precisa simular history manualmente.
- Escalabilidade: média.
- Manutenção: média — wizard tende a virar componente gigante.

**Opção A3 — Modal/Sheet full-screen disparado do `+`, sem rota dedicada**
- Vantagens: mais leve; nunca redireciona; bom em mobile.
- Desvantagens: idem A2 + perde a entrada `/appointments/new` que já existe e está documentada.
- Manutenção: média.

**→ Escolha: A1.** Já existe a estrutura de 3 rotas e um Zustand draft persistido — basta plugar o `<Outlet />`. Mantém URL/back-button/analytics e é o padrão recomendado pela docstring `tanstack-route-architecture` (parent layout sempre renderiza `<Outlet />`).

---

### Decisão B — Como consertar o guard `_admin` (P0.2)

**Opção B1 — Trocar `requireAdmin` por checagem client-side via `useCurrentUser`**
- Vantagens: sem race com bearer; reutiliza cache do React Query; resposta instantânea.
- Desvantagens: gate executa só após hidratação; usuário pode ver flash do `Outlet` por 1 frame. Não é defesa real — depende do servidor recusar dados sensíveis (já garantido por RLS + `getFinanceSummary`).
- Escalabilidade: alta — sem round-trip a cada navegação.

**Opção B2 — Manter `requireAdmin` mas esperar bearer (retry/await da sessão)**
- Vantagens: gate continua server-validated.
- Desvantagens: complexo; `beforeLoad` precisa aguardar `supabase.auth.getSession()` antes do serverFn; ainda tem latência.
- Manutenção: baixa robustez (race conditions sutis).

**Opção B3 — Híbrido: gate client-side rápido + serverFn `requireAdmin` no loader de cada rota admin**
- Vantagens: fail-fast no client + checagem real no server.
- Desvantagens: duplica esforço; mais código.

**→ Escolha: B1.** A defesa real é RLS + `requireAdmin` dentro de cada serverFn admin (que continuam existindo). O `beforeLoad` só decide para onde mandar o usuário; client-side é suficiente e elimina o bug.

---

### Decisão C — Como resolver a hydration mismatch (P0.3)

**Opção C1 — Envolver `AuthPage` em `<ClientOnly>` do TanStack**
- Vantagens: 1 linha; alinhado ao padrão do framework.
- Desvantagens: server entrega placeholder vazio (SEO irrelevante aqui).
- Manutenção: trivial.

**Opção C2 — Eliminar `ssr:false` e garantir markup determinístico**
- Vantagens: SSR de verdade na tela de login.
- Desvantagens: precisa remover toda referência a `window`/`localStorage` no path SSR de `AuthPage`; risco de regressão; sem benefício real (login não precisa de SSR).

**→ Escolha: C1.** `/auth` é descartável para SEO e já é `ssr:false`; o problema é só o fallback do Suspense divergir do conteúdo. `<ClientOnly>` resolve sem efeito colateral.

---

### Decisão D — O que fazer com a nav inferior (Services/Reviews/Menu) (P1.2)

**Opção D1 — Esconder os botões até serem implementados**
- Vantagens: zero expectativa frustrada; nav fica limpa (Agenda + `+`).
- Desvantagens: visualmente "vazia".

**Opção D2 — Substituir por destinos reais mínimos (catálogo de Services apenas-leitura + Menu = perfil/logout)**
- Vantagens: cobre 2 dos 3 botões com baixo custo; `services` já vem do Supabase.
- Desvantagens: mais escopo nesta sprint.

**Opção D3 — Manter como `comingSoon` indefinidamente**
- Vantagens: nenhuma.
- Desvantagens: péssima UX; sinal de produto inacabado.

**→ Escolha: D2** para Services (leitura) e Menu (perfil + logout), **D1** para Reviews até decidir o produto. Justificativa: dá utilidade real à nav, valoriza dados já existentes e remove a sensação de "demo".

---

### Decisão E — Limpeza dos dados demo do financeiro (P1.6)

**Opção E1 — Migration que apaga os 3 rows seed**
- Vantagens: produção limpa.
- Desvantagens: dev perde dados para testar a tela.

**Opção E2 — Marcar `status='cancelled'` e filtrar em `getFinanceSummary`**
- Vantagens: mantém histórico em dev; código de produção mais defensivo.
- Desvantagens: lógica extra.

**Opção E3 — Mover o seed para script idempotente fora de migrations + tabela `feature_flags` ou env `SEED_DEMO`**
- Vantagens: dev controla; produção nunca recebe.
- Desvantagens: mais infra.

**→ Escolha: E1 + criar arquivo `supabase/seed.sql` separado para dev**. Migration de produção remove os 3 rows; o seed.sql opcional repõe em ambientes locais. É o padrão Supabase e evita acoplar lógica de negócio a "se for demo".

---

### Decisão F — Sincronização GHL ↔ Supabase (P2.4)

**Opção F1 — Read-through cache: ler GHL, escrever no Supabase em background, fallback para Supabase em caso de falha**
- Vantagens: resiliência sem mudar modelo mental.
- Desvantagens: cache stale pode confundir.

**Opção F2 — App = source of truth; push para GHL após cada escrita**
- Vantagens: telas instantâneas.
- Desvantagens: divergência se push falhar; requer reconciliação.

**Opção F3 — Webhooks GHL → endpoint Lovable `/api/public/hooks/ghl-events` + cron de backfill**
- Vantagens: near-real-time; canônico.
- Desvantagens: requer config no GHL; webhook secret.

**→ Escolha: F3 (webhooks) + cron de backfill de 10 min como rede de segurança.** Mantém GHL como verdade operacional (calendário do estúdio) e o Supabase como espelho confiável para histórico, financeiro e offline. Alinha com o que já foi prometido em planos anteriores.

---

## 3. Roadmap por Sprints

> Cada Sprint ~ 1 semana de trabalho focado. Cada Sprint termina com **validação E2E via Playwright** e relato dos resultados.

### Sprint 1 — Estancar o sangramento (P0)
**Objetivo**: zero quebras críticas; todos os fluxos navegáveis ponta a ponta.
1. P0.2 — Guard `_admin` client-side (Opção B1).
2. P0.1 — `<Outlet />` no parent `appointments.new` + mover form para `appointments.new.index.tsx` (Opção A1).
3. P0.3 — `<ClientOnly>` em `AuthPage` (Opção C1).
4. P1.1 — `Save`/`Checkout` desabilitados sem draft válido (cliente + artista + slot + 1 serviço).
5. Validação Playwright: login admin, navegar 3 telas de novo agendamento, criar contato real, criar appointment real no GHL, ver no `/agenda`, ver no `/financeiro`.

**Saída**: app sem rota quebrada, sem erro de hidratação, sem ação destrutiva habilitada por engano.

---

### Sprint 2 — Confiabilidade dos dados visíveis (P1)
**Objetivo**: o que aparece na tela tem que estar correto.
1. P1.5 — Corrigir `deriveBucket` no branch Artist (cruzar com `payments`).
2. P1.6 — Migration removendo seeds demo + `supabase/seed.sql` separado.
3. P1.4 — Estado vazio explicado na Agenda (3 estados: erro / sem expediente / dia vazio); contadores `●○` derivados corretamente de eventos + slots.
4. P1.3 — Auditoria de i18n: chaves faltantes em `pt.json`, `Intl.DateTimeFormat` com locale `pt-PT` e TZ `Europe/Brussels` em todo header.
5. Validação Playwright: financeiro coerente entre Admin/Artist; Agenda mostra mensagem correta em domingo; nenhum texto em EN nas 3 rotas principais.

---

### Sprint 3 — Sincronização GHL e resiliência (P2.4)
**Objetivo**: histórico e financeiro independentes da disponibilidade do GHL.
1. Tabela `ghl_sync_state` + webhook `/api/public/hooks/ghl-events` com verificação de assinatura.
2. `createServerFn` `syncGhlAppointment(eventId)` chamado pelo webhook (upsert em `contacts` + `appointments`).
3. Cron 10 min via `pg_cron` chamando `/api/public/hooks/ghl-sync-backfill` (Opção F3).
4. Banner "modo offline" na Agenda quando o último fetch GHL falhar.
5. Validação Playwright: simular GHL down (proxy retornando 503) e confirmar que agenda + financeiro continuam usáveis.

---

### Sprint 4 — Autenticação e contas reais (P2.1, P2.2)
**Objetivo**: pronto para usuários reais (não só seed).
1. Webhook Supabase Auth → `lovable/email/auth/webhook` plugado nos templates já scaffolded.
2. Tela `/auth/forgot-password` + `/auth/reset-password`.
3. Tela `/menu` (Opção D2): perfil + logout limpo (cancelQueries → clear → signOut → navigate).
4. Tela `/services` somente-leitura (Opção D2).
5. Esconder botão "Reviews" (Opção D1).
6. Seed-test-users endpoint protegido por `SEED_SECRET` apenas em dev (atualmente já é, validar).
7. Validação Playwright: signup → recovery e-mail → reset → login.

---

### Sprint 5 — Polimento e operação (P2.3, P2.5, débito)
**Objetivo**: produto sustentável.
1. Decidir Recurrence: esconder ou implementar (recomendação: esconder agora, criar issue para v2).
2. Overflow `⋯` no checkout: esconder ou implementar "cancelar/duplicar".
3. Captura de erros client → tabela `error_log` com `requireSupabaseAuth` (P2.5).
4. Dashboard mínimo do Admin: KPIs do mês (total, comissões, próximos agendamentos).
5. Hardening RLS: revisão de todas as policies criadas (rodar `supabase--linter`).
6. Validação Playwright: smoke test completo (login → criar appointment → marcar pago → ver no dashboard).

---

## 4. Notas técnicas transversais

- **i18n**: padronizar `useTranslation` + `Intl.DateTimeFormat({locale, timeZone:"Europe/Brussels"})`. Proibir chamadas a `toLocaleDateString()` sem args.
- **Guards**: gate em `_authenticated` é managed (não tocar); gates de role devem usar `useCurrentUser` no client + `requireAdmin`/`has_role` no server. Nunca confiar só no client.
- **GHL**: edge function `ghl-proxy` continua sendo o único ponto de saída; adicionar guard de `calendarId` por papel já existe — manter.
- **Migrations**: toda nova tabela `public.*` precisa do bloco GRANT padrão; rodar `supabase--linter` após cada Sprint que tocar SQL.
- **Testes**: cada Sprint encerra com script Playwright commitado em `/tmp/browser/<sprint-N>/` (não no repo) e relatório textual no chat.

---

## 5. Resumo executivo

| Sprint | Foco | Itens | Saída visível |
|---|---|---|---|
| 1 | Quebras P0 | Outlet, admin guard, hydration, validação botões | App sem rotas mortas |
| 2 | Dados corretos | Buckets, seeds, estado vazio, i18n | Tela confiável |
| 3 | Resiliência GHL | Webhook + cron + offline banner | Independente do GHL |
| 4 | Auth real | E-mails, recovery, /menu, /services | Pronto para usuários reais |
| 5 | Polimento | Erros, dashboard, RLS lint, decidir stubs | Operável em produção |

**Decisão final do CTO**: começar pelo Sprint 1 imediatamente após aprovação. As demais sprints só são detalhadas em planos próprios (uma por vez) para evitar over-engineering antecipado e permitir revalidação de prioridades a cada entrega.

Aprove este plano (ou peça ajustes) para que eu inicie a execução do Sprint 1.
