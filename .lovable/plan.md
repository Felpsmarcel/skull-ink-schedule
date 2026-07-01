## Contexto

- No banco: a artista "GF TATTOO" (`calendarId=VaZknkE8GbWu4P1Fqyn0`) tem 8 agendamentos sincronizados, o mais recente hoje 17:20.
- No GHL ao vivo (últimas chamadas do proxy): esse calendário devolve **1 evento em 04/07** e **0 em 02/07 e 03/07**. Ou seja, o calendário está esparso — pode ser genuíno ou pode ser mapeamento errado (o calendário `VaZknkE8GbWu4P1Fqyn0` pode não ser o que o dono considera "GF TATTOO").
- O cron automático de sync **não está instalado** (`vault_ok:false`, `job:null`), então só entra o que veio do último clique manual.

Sem um exemplo concreto (data + cliente que está no GHL e sumido no app), preciso de 1 passo de diagnóstico antes de mudar código.

## Passo 1 — Diagnóstico (sem mudar código)

1. Ler o calendário `VaZknkE8GbWu4P1Fqyn0` no GHL numa janela ampla (últimos 30 dias + próximos 90) via `ghl-proxy` e comparar com `appointments` no Supabase para o mesmo artista.
2. Listar todos os calendários do location `9iqrKUVPDddINb9S4Iwd` no GHL (`GET /calendars/?locationId=…`) e verificar se `VaZknkE8GbWu4P1Fqyn0` é mesmo o calendário chamado "GF TATTOO" no GHL — mapeamento trocado é a hipótese mais provável quando "só um artista fica vazio".
3. Verificar se os 8 eventos do banco realmente existem no GHL hoje (podem ter sido apagados/movidos lá).

Resultado do passo 1 direciona o passo 2:

## Passo 2 — Correção conforme o achado

**Caso A — Mapeamento trocado** (o `ghl_calendar_id` de "GF TATTOO" no Supabase aponta para outro calendário do GHL): migração corrigindo `artists.ghl_calendar_id` do artista `b33f16d8-…` para o ID certo. Rodar sync depois para repovoar.

**Caso B — Calendário certo, GHL realmente vazio nos dias abertos**: não é bug, é conteúdo. Melhorar o empty-state da Agenda ("Nenhum agendamento neste dia") para não parecer que o app está quebrado. Alteração só em `src/routes/_authenticated/agenda.tsx`.

**Caso C — Eventos existem no GHL mas o sync não trouxe** (ex.: status filtrado, janela curta): ajustar `syncGhlAppointments` (`src/lib/sync.server.ts`) — hoje ele varre `-7d / +90d`. Se o dono cria eventos com mais antecedência ou histórico maior, ampliar a janela e re-executar backfill.

## Passo 3 — Ativar sync automático (recomendado, independente do achado)

Hoje o cron `ghl-sync-10min` não está instalado (`vault_ok:false`). Enquanto isso, qualquer evento novo no GHL só aparece no /financeiro/relatórios depois que alguém clica "Sincronizar". Proponho, no mesmo turno:

1. Popular o secret no Vault: `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='ghl_sync_anon_key'), '<anon publishable key>')`.
2. Rodar `SELECT public.schedule_ghl_sync()` como admin → cria o cron `*/10 * * * *` que chama `/api/public/hooks/sync-ghl`.
3. Confirmar via `SELECT public.ghl_sync_status()`.

## O que preciso de você antes do passo 2

Um exemplo concreto para acelerar o diagnóstico: **1 agendamento (data, hora, nome do cliente)** que está no GHL na conta "GF TATTOO" e que **não aparece na tela Agenda do app**. Sem isso, executo o Passo 1 às cegas comparando calendários e reporto o achado antes de mexer em código.  
Hora do compromisso

**Reagendado**

**Sab, 4 de julho de 2026, 13h00 - 13h30 (CEST)**

Nome de

**Artur Palmerio**

Telefone

Proprietário do compromisso

**Estúdio de tatuagem GF**

Calendário

**[GFTATTOO] - [RANDEVU]**

Convidados

**Artur Palmerio**

Reservado por

**Gabriel Fernandes**

**Sab, 4 de julho de 2026, 14h00 - 14h30 (CEST)**

Nome de

**Floriane**

Telefone

**+32 477 30 73 70**

E-mail

**-**

Proprietário do compromisso

**Estúdio de tatuagem GF**

Localização

**-**

Calendário

**[GFTATTOO] - [RANDEVU]**

Convidados

**Floriane**

Reservado por

**Felipe Fernandes**