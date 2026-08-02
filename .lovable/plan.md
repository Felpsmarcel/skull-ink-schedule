## Diagnóstico (verificado nos dados)

A coluna "Cliente" aparece "—" porque **nenhum agendamento tem nome de cliente gravado**:

- 462 agendamentos: `contact_name` está vazio em **462** (100%). Todos têm `ghl_contact_id`.
- Os 314 contactos criados pelo sync têm nome literal **"Sem nome"** e telefone vazio.

Causa: o sync lê o endpoint de eventos do calendário do GHL, que devolve apenas o **ID** do contacto — não o nome. O código tenta ler `e.contact.name` / `firstName` / `lastName`, campos que esse endpoint nunca envia, então grava `NULL` no agendamento e "Sem nome" no contacto.

O relatório está correto: ele mostra exatamente o que está na base (vazio).

Nota: "Estilo" e "Tamanho" também estão vazios em todos os registos — são campos preenchidos só pelo fluxo interno de agendamento, não vêm do GHL. Fora do escopo deste fix.

## O que vou fazer

1. **Buscar o contacto no GHL durante o sync**
   Para cada ID de contacto novo, consultar o cadastro do contacto no GHL e trazer nome, telefone e email. Fazer isso em lote, com cache por execução (o mesmo cliente aparece em vários agendamentos) e sem quebrar o sync se uma consulta falhar — nesse caso mantém o registo e regista a falha.

2. **Gravar de verdade**
   - `contacts`: nome real, telefone e email (deixa de ser "Sem nome").
   - `appointments.contact_name` / `contact_phone` / `contact_email`: preenchidos no insert e atualizados nos agendamentos já existentes.

3. **Preencher o histórico (backfill)**
   Rotina administrativa que percorre os 462 agendamentos sem nome, busca os contactos no GHL e preenche. Disparada por botão no painel admin, com contagem de quantos foram preenchidos.

4. **Rede de segurança na exibição**
   No relatório de agendamentos, quando o nome do agendamento estiver vazio, usar o nome do contacto ligado; só mostrar "—" se ambos estiverem vazios. Assim o relatório aproveita qualquer nome já disponível sem esperar o backfill.

## Detalhes técnicos

- `src/lib/sync.server.ts`: nova função de enriquecimento via `GET /contacts/{id}` (API GHL v2, mesmo token/`Version` já usados), com `Map` de cache e concorrência limitada; usar o resultado nos upserts de `contacts` e nos insert/update de `appointments`.
- Nova server fn de backfill em `src/lib/ghl-sync-admin.functions.ts` (admin-only) + botão em `/admin/reconciliar` ou junto do `SyncGhlButton`.
- Migração para atualizar `public.get_monthly_report`: `COALESCE(NULLIF(a.contact_name,''), c.name)` com `LEFT JOIN public.contacts c ON c.id = a.contact_id`, ignorando o placeholder "Sem nome".
- Sem alteração de schema; campos já existem.
