# Ligar o MCP ao CRM real (HighLevel)

Hoje as ferramentas MCP leem a base de dados do aplicativo. Passam a ler o CRM ao vivo, tanto na parte financeira como na agenda, mantendo as permissões por utilizador.

## O que muda para quem usa

- `resumo_financeiro` e `list_movimentacoes` passam a devolver os registos financeiros que existem no CRM no período pedido (não os do app).
- `list_appointments` passa a devolver os eventos dos calendários do CRM dos tatuadores no período pedido.
- Cada resposta indica claramente a origem (`fonte: "crm"`) e o período consultado, para não haver dúvida sobre de onde vieram os números.
- Se o CRM falhar ou estiver indisponível, a ferramenta diz isso de forma explícita em vez de mostrar silenciosamente números do app.
- `list_artists` continua a ler do app (é a lista de tatuadores e comissões do estúdio, não existe no CRM).

## Permissões

O acesso continua a passar pelo login: antes de chamar o CRM, a ferramenta identifica o utilizador autenticado e o seu papel.

- Admin: vê tudo no período.
- Tatuador: só os registos e agendamentos do seu próprio calendário/nome.
- Vendedor: só o que lhe corresponde.

Sem sessão válida, nada é devolvido.

## Detalhes técnicos

1. Novo módulo server-only `src/lib/mcp/crm.server.ts`:
   - reutiliza `GHL_TOKEN`, `LOCATION_ID` e o padrão de `ghlFetch` já usado em `src/lib/movimentacao-ghl.server.ts` e `src/lib/sync.server.ts`;
   - `fetchCrmMovimentacoes(from, to)`: resolve o `objectKey` do custom object `movimentacao_financeira` (cache em `app_settings`, igual ao existente) e faz a busca de records do CRM, com paginação e filtro por `data_pagamento`;
   - `fetchCrmAppointments(from, to, calendarIds)`: usa `GET /calendars/events` (mesmo endpoint/versão de `ghlGetEvents`) para cada `ghl_calendar_id` ativo;
   - normaliza os campos do CRM para o mesmo formato que as ferramentas já devolvem (cliente, tatuador, formas de pagamento, total, datas), para não quebrar quem já usa as respostas.
2. Escopo por utilizador: as ferramentas continuam a usar `supabaseForUser(ctx)` apenas para resolver identidade/papel e os `artists` (id, nome, `ghl_calendar_id`, slug). Esse mapa é usado para filtrar as linhas vindas do CRM antes de devolver.
3. Atualizar as três ferramentas em `src/lib/mcp/tools/` para chamar o CRM, agregar os totais (`por_forma`, `por_tatuador`) a partir dos dados do CRM, e devolver `fonte`, `periodo` e `count` no `structuredContent`.
4. Falhas de CRM: `isError: true` com mensagem curta, e registo via `logOperationalEvent` (`src/lib/observability.server.ts`) para aparecer em `/admin/saude`.
5. Regenerar o manifesto MCP (`.lovable/mcp/manifest.json`) após a alteração das descrições, e validar com um typecheck e os testes existentes. Nada é publicado.

## Verificação

- Comparar, num período curto (por exemplo a última semana), o total devolvido pelo `resumo_financeiro` com o total registado no CRM.
- Confirmar que um utilizador tatuador só recebe as suas próprias linhas.
- Confirmar que sem sessão a ferramenta responde "Não autenticado".
