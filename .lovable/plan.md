## Diagnóstico do screenshot

Olhando o snapshot do preview:

- **i18n**: "AGENDA.TODAY", "NAV.AGENDA", "NAV.SE...", "NAV.MENU" aparecem em maiúscula = `t()` está retornando a própria chave. Os JSONs (pt/fr/en) estão corretos, então é cache do Vite/i18n: `src/i18n/index.ts` tem `if (!i18n.isInitialized)` que segura a re-init mesmo quando os recursos mudam. Hard-refresh do browser não invalida o módulo i18n do bundle Vite — precisa restart do dev server OU init idempotente.
- **Grade vazia**: 5 colunas mostram `0● 0○` e a coluna de horários `--:--`. Você confirmou que há agendamentos hoje → **as queries resolveram com 0 free + 0 booked**, OU o parser não reconhece o shape da resposta do GHL. O snapshot não tem nenhum request `ghl-proxy` capturado nem console.log, então não consigo confirmar qual. Preciso de logs.

## O que vou fazer

### 1. Consertar i18n (definitivo)
- Reescrever `src/i18n/index.ts`: em vez do guard `!isInitialized`, sempre chamar `i18n.addResourceBundle(lng, "common", bundle.common, true, true)` para cada idioma. Isso funciona mesmo após HMR sem precisar restart.
- Restart do dev server para garantir bundle limpo.

### 2. Tornar a agenda observável (para encontrar o bug dos dados)
- **Edge function `ghl-proxy`**: adicionar `console.log` com `{ upstreamUrl, status, sample: text.slice(0, 300) }` em cada chamada → vai aparecer em `supabase--edge_function_logs ghl-proxy` e me permite ver o shape exato.
- **Painel debug colapsável** no topo da agenda (ícone "bug" no header, visível só quando `?debug=1` está na URL): mostra para cada staff o `freeStarts.length`, `events.length`, primeiros 200 chars do JSON cru de free-slots e events. Sem isso continuamos no escuro.
- **Parser `extractFreeSlotStarts` mais tolerante**: aceitar também shape plano `{ slots: ["ISO", ...] }` e `{ _dates_: {...} }` além do `{ "YYYY-MM-DD": { slots: [...] } }`.

### 3. Grade 08–22 sempre visível
- Mesmo quando o GHL devolve 0 free + 0 events, renderizar a grade default 08:00–22:00 com todos os slots em `outside` (cinza). Hoje, sem dados, a coluna de horário cai num fallback "--:--" feio. A nova versão mostra labels reais (`08:00`, `08:30`, …) o tempo todo.

### 4. Preview em mobile
- Trocar o viewport do preview para mobile (a tela é mobile-first, no canvas desktop fica espremida e confunde o diagnóstico visual).

## O que NÃO vou mexer

- Edge function continua igual em arquitetura (proxy puro), só ganha logs.
- Sem alterar config de staff, sem alterar lógica de timezone (já está em Europe/Brussels), sem alterar refresh de 2 min, sem alterar UI da grade além do default 08–22.

## Como vai funcionar o teste depois da implementação

1. Recarregar `/agenda` — header e bottom nav devem mostrar texto traduzido ("Hoje", "Agenda", "Serviços", "Avaliações", "Menu").
2. Mesmo sem dados, grade mostra `08:00` → `22:00` com slots cinza.
3. Abrir `/agenda?debug=1` → painel mostra contagens e amostra crua das respostas. Você me manda o conteúdo (ou eu leio via `supabase--edge_function_logs ghl-proxy`) e a partir do shape real eu ajusto o parser num próximo passo, sem chutar.

## Arquivos afetados

- `src/i18n/index.ts` — init idempotente.
- `supabase/functions/ghl-proxy/index.ts` — logs estruturados.
- `src/lib/agenda-grid.ts` — parser de free-slots mais tolerante + grade default sempre 08–22.
- `src/routes/agenda.tsx` — painel debug condicional, coluna de horários sempre com labels reais.
- Preview viewport → mobile.
