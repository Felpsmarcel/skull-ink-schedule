
# Jornada do tatuador após definir a senha

Hoje, ao salvar a nova senha em `/auth/update-password`, o tatuador é jogado direto em `/agenda` sem contexto. Nenhum passo de boas-vindas, nenhum preenchimento de perfil, nenhuma orientação sobre o que fazer em seguida. Este plano estrutura a jornada completa.

## Visão geral do fluxo

```text
Email de convite
   → /auth/update-password (define senha)
   → /onboarding/bem-vindo           (tela 1 — boas-vindas + o que esperar)
   → /onboarding/perfil              (tela 2 — nome, telefone, foto, bio, especialidades)
   → /onboarding/disponibilidade     (tela 3 — dias/horários que atende)
   → /onboarding/servicos            (tela 4 — confirma serviços que executa)
   → /onboarding/pronto              (tela 5 — resumo + próximos passos)
   → /agenda                         (destino final; tour guiado na 1ª visita)
```

O onboarding é **obrigatório na primeira sessão** e pode ser retomado se abandonado (a flag `onboarded_at` no `artists` controla). Admin nunca vê o fluxo.

## Detalhamento das telas

### 1. `/onboarding/bem-vindo`
- Mensagem curta ("Bem-vindo à GF Tattoo, {nome}"), o que o app faz por ele (agenda unificada, comissões, lembretes) e tempo estimado do setup (~2 min).
- Botão único: **Começar**.

### 2. `/onboarding/perfil`
Edita a linha do `artists` já criada pelo convite:
- Nome (pré-preenchido), telefone, avatar (upload storage), bio curta, especialidades (chips múltipla escolha: fine line, blackwork, realismo, colorido, oriental, lettering, cover-up).
- Validação: nome + telefone obrigatórios; avatar recomendado mas opcional.

### 3. `/onboarding/disponibilidade`
- Grade semanal simples (Seg–Dom) com horário início/fim por dia + toggle "não atendo".
- Salva como `availability_blocks` recorrentes (ou tabela nova `artist_weekly_availability` se preferir — ver seção técnica).
- Botão "Pular por agora" permitido; nesse caso mostra alerta amarelo persistente na agenda até configurar.

### 4. `/onboarding/servicos`
- Lista o catálogo global de `services` com checkbox "eu executo este serviço".
- Cria/atualiza `artist_services` (tabela de junção) para filtrar o que aparece no fluxo `/appointments/new`.
- Botão "Pular" permitido.

### 5. `/onboarding/pronto`
- Confirmação visual + 3 cards de próximas ações:
  1. **Ver minha agenda** → `/agenda`
  2. **Criar meu primeiro agendamento** → `/appointments/new`
  3. **Ver meu financeiro** → `/financeiro`
- Ao clicar em qualquer um, marca `artists.onboarded_at = now()` e navega.

## Após o onboarding — primeira sessão em `/agenda`
- **Empty state melhorado**: se não há agendamentos hoje, mostrar card "Sua semana está livre — compartilhe seu link de agendamento" com CTA para copiar link público (`gftattoocalendar.com/book/{artist_slug}` — se já existir).
- **Tour guiado leve** (3 tooltips sequenciais, dismissível): "Aqui está sua agenda", "Toque em + para novo agendamento", "Menu embaixo tem financeiro e perfil".
- Estado guardado em `localStorage` (`agenda_tour_seen_v1`).

## Redirecionamento condicional

Alterar `auth_/update-password.tsx` e o `beforeLoad` de `/_authenticated`:
- Após `updateUser({ password })` bem-sucedido, buscar `app_users` + `artists.onboarded_at`.
- Se role = `artist` e `onboarded_at` for null → navegar para `/onboarding/bem-vindo`.
- Caso contrário → `/agenda` (comportamento atual).
- `_authenticated/route.tsx` também redireciona para o onboarding se detectar artist com `onboarded_at` null tentando acessar outra rota (exceto `/onboarding/*` e `/menu`).

## Notificações e comunicação
- **Email de boas-vindas #2** (transacional, disparado ao completar o onboarding): "Você está pronto — próximos passos", com links diretos para agenda, novo agendamento e link público.
- **Banner in-app** persistente enquanto disponibilidade estiver vazia.
- Nada de push por enquanto (fora do escopo).

## Detalhes técnicos

- **Migration**:
  - `alter table artists add column onboarded_at timestamptz null;`
  - `create table artist_services (artist_id uuid, service_id uuid, primary key(artist_id, service_id))` + GRANTs + RLS (artist lê/escreve os próprios; admin tudo).
  - (Opcional) `create table artist_weekly_availability (artist_id, weekday smallint 0-6, start_time time, end_time time)` + GRANTs + RLS — mais limpo do que `availability_blocks` recorrentes.
- **Rotas novas** (arquivos em `src/routes/_authenticated/`):
  - `onboarding.tsx` (layout com stepper + Outlet)
  - `onboarding.bem-vindo.tsx`, `onboarding.perfil.tsx`, `onboarding.disponibilidade.tsx`, `onboarding.servicos.tsx`, `onboarding.pronto.tsx`
- **Server fns novas** em `src/lib/onboarding.functions.ts`:
  - `getOnboardingStatus`, `updateArtistProfile`, `setWeeklyAvailability`, `setArtistServices`, `completeOnboarding` (todas com `requireSupabaseAuth`).
- **Upload de avatar**: bucket `artist-avatars` público, RLS de upload restrito ao próprio artist.
- **Novo template de email** `artist-onboarding-complete.tsx` + registro em `email-templates/registry.ts`, disparado no `completeOnboarding`.
- **Hook**: `useOnboardingGuard()` usado pelo `_authenticated/route.tsx`.

## Fora do escopo (para depois)
- Portfólio/galeria de trabalhos do tatuador.
- Página pública do tatuador com booking direto.
- App mobile / push notifications.
- Convite de clientes pelo próprio tatuador.

## Ordem de implementação sugerida
1. Migration (`onboarded_at`, `artist_services`, `artist_weekly_availability`, bucket) — **passo isolado, precisa aprovação**.
2. Server fns + guard de redirecionamento.
3. Telas 1–5 do onboarding.
4. Ajuste do redirect em `update-password`.
5. Empty state + tour em `/agenda`.
6. Email pós-onboarding.
