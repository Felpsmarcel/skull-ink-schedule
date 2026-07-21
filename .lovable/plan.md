# Auditoria do Módulo "Link do Tatuador / Registro de Pagamento"

> Escopo: leitura de código, schema e dados reais. Zero alterações.

---

## 1. O que entendi por "Link do Tatuador"

Cada pessoa tem um slug fixo (`gabriel`, `andre`, `joyce`, `augusto`, `nivia`) que abre a mesma página de formulário, mudando apenas quem é o "Recebido por". Tatuadores registram pagamentos próprios; a Nivia registra pagamentos que ela recebeu para terceiros e escolhe manualmente qual tatuador é responsável pela tatuagem. O slug não deve permitir troca de identidade por edição na URL.

---

## 2. O que foi realmente implementado

- **Uma única página parametrizada** por slug: `src/routes/_authenticated/movimentacao.$slug.tsx`.
- **Rota autenticada** (dentro de `_authenticated`) — não é link público; exige login.
- Mapa slug → identidade em `src/config/movimentacao-slugs.ts` (IDs hard-coded).
- Server functions em `src/lib/movimentacao.functions.ts`: `getSlugContext`, `getMySlug`, `listArtistsForSelect`, `createMovimentacao`, `reprocessFailedMovimentacoes`.
- Sync HighLevel em `src/lib/movimentacao-ghl.server.ts` (best-effort, não desfaz insert local).
- Página admin `/admin/movimentacao-links` com status/reprocessar.
- Card de acesso rápido em `menu.tsx` e `onboarding.bem-vindo.tsx` (`PaymentLinkCard`).

---

## 3. Fluxo atual do registro

1. Usuário autenticado abre `/movimentacao/<slug>`.
2. `getSlugContext` valida slug, busca `app_users` do dono via `supabaseAdmin` (filtro `role='artist'` ou `role='seller'`), compara `userId` com o dono. Não-dono e não-admin → `forbidden_slug` → redireciona para o slug próprio (via `getMySlug`).
3. Formulário coleta: cliente, data pagamento, tatuador, tipo, 4 valores, data tatuagem, observações + `chave_idempotencia` UUID gerada no client.
4. `createMovimentacao` re-valida, faz INSERT em `public.movimentacoes` (via admin client), depois chama `syncMovimentacaoToGhl`.
5. Sync GHL: descobre/cria custom object `movimentacao_financeira` (cacheia key em `app_settings`), faz POST `/objects/{key}/records` com `externalId=chave_idempotencia`. Sucesso → `ghl_sync_status='synced'`; falha → `'failed'` + `ghl_sync_error`.

---

## 4. Links e rotas existentes

Todos exigem sessão iniciada em `https://www.gftattoocalendar.com`:

- Gabriel: `/movimentacao/gabriel`
- André: `/movimentacao/andre`
- Joyce: `/movimentacao/joyce`
- Augusto: `/movimentacao/augusto`
- Nivia: `/movimentacao/nivia`

Auxiliares: `/movimentacao` (redirect via `getMySlug`), `/admin/movimentacao-links`.

Identificação: **sessão autenticada + slug na URL**. O par (userId, slug) tem de bater com `app_users.id` do dono do slug (ou o usuário é admin). Sem token → `requireSupabaseAuth` retorna 401.

Trocar o slug na URL **não** permite registrar como outra pessoa: `recebido_por_app_user_id` vem sempre de `resolveSlugOwner(slug)`, e não-donos são bloqueados (só admin pode abrir slug alheio, com badge "admin").

---

## 5. Campos — status real


| Campo                                                                     | Status                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| nome_cliente                                                              | Implementado ✔                                                               |
| data_pagamento                                                            | Implementado ✔                                                               |
| tatuador (`artist_id`)                                                    | Implementado ✔                                                               |
| tipo_movimento                                                            | Implementado ✔ (enum: sinal/sessao/saldo/produto/estorno)                    |
| valor_cartao / valor_dinheiro / valor_sumup / valor_transferencia         | Implementados ✔ (cartão⊕sumup exclusivos)                                    |
| total                                                                     | Implementado ✔ (coluna gerada no DB)                                         |
| data_tatuagem                                                             | Implementado ✔ (obrigatório em `sinal`)                                      |
| observacoes                                                               | Implementado ✔                                                               |
| recebido_por (`recebido_por_app_user_id`)                                 | Implementado ✔ (server-side pelo slug)                                       |
| registrado_por (`registrado_por_app_user_id`)                             | Implementado ✔ (`context.userId`)                                            |
| link_origem                                                               | Implementado ✔ (= slug)                                                      |
| origem_lancamento                                                         | Implementado ✔ (fixo `"link_individual"`)                                    |
| chave_idempotencia                                                        | Implementado ✔ (UUID + `externalId` no GHL)                                  |
| ghl_sync_status / ghl_sync_error / ghl_sync_attempts / ghl_last_synced_at | Implementados ✔                                                              |
| ghl_custom_object_id                                                      | Implementado ✔                                                               |
| referencia                                                                | Coluna existe, **nunca preenchida** ✗                                        |
| id_contacto (`ghl_contact_id`)                                            | Coluna existe, **não implementado** ✗ (não há busca/match de contato no GHL) |
| id_oportunidade (`ghl_opportunity_id`)                                    | Coluna existe, **não implementado** ✗                                        |
| data_hora_registro                                                        | Coberto por `created_at` (timestamptz) ✔                                     |


Total = cartão + dinheiro + sumup + transferência ✔. Pagamento misto é armazenado numa única linha com 4 valores parciais; não há linhas por forma — precisa ser confirmado como o esperado pelo negócio.

---

## 6. Integração HighLevel

- Base: `https://services.leadconnectorhq.com` · Version `2021-07-28` · locationId `9iqrKUVPDddINb9S4Iwd` · token em `GHL_TOKEN`.
- Objeto: `movimentacao_financeira` (labels "Movimentação Financeira / Movimentações Financeiras"). Auto-descoberto ou auto-criado na primeira sincronização e cacheado em `app_settings.ghl_movimentacao_object_key`.
- Endpoint de criação de registro: `POST /objects/{objectKey}/records`.
- `externalId` = `chave_idempotencia` (dedupe no GHL).
- Propriedades enviadas: `nome_cliente, data_pagamento, artist_name, recebido_por, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes`.
- **Não** cria/relaciona `Contact` nem `Opportunity` — os campos `ghl_contact_id`/`ghl_opportunity_id` ficam nulos.

Estado atual em produção:

- `public.movimentacoes` → **0 linhas**. O fluxo end-to-end **nunca foi executado**.
- `app_settings['ghl_movimentacao_object_key']` → **vazio**. Custom object ainda não foi descoberto/criado; o schema `movimentacao_financeira` no GHL ainda não foi validado.

---

## 7. Erros / riscos encontrados


| #   | Erro                                                            | Reprodução                   | Causa                                                                                                                                                                                                                                            | Arquivo                                        | Impacto                                                                                                                                                                         | Correção sugerida                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Link da Nivia quebrado**                                      | Abrir `/movimentacao/nivia`  | Não existe `app_users` com `seller_id='cce99d65-…'`. `resolveSlugOwner` lança "Nenhuma conta linkada a Nivia".                                                                                                                                   | `movimentacao.functions.ts:98-113`             | Nivia não consegue registrar pagamento nenhum.                                                                                                                                  | Criar app_user da Nivia com `role='seller'`, `seller_id` correto (via `/admin/vendedores` — convite ou repair).                                                                  |
| 2   | **Slug Augusto ambíguo**                                        | Consulta ao banco            | 2 `app_users` `role='artist'` apontam para o mesmo `artist_id`. `resolveSlugOwner` pega o mais antigo por `created_at`.                                                                                                                          | mesmo                                          | `recebido_por_app_user_id` pode ficar num usuário órfão; o Augusto real pode ver `forbidden_slug`.                                                                              | Deduplicar `app_users` (excluir o duplicado) ou vincular explicitamente pelo `app_user_id` no config.                                                                            |
| 3   | **Slug Gabriel + role admin**                                   | login como Gabriel admin     | Gabriel tem 2 rows admin e 1 artist; `resolveSlugOwner` seleciona a row artist. Se Gabriel logar como admin, `isOwner=false`, mas `isAdmin=true` mantém acesso — porém `recebido_por_app_user_id` aponta para outro id do Gabriel, não o logado. | mesmo                                          | Relatórios que agregam por `recebido_por_app_user_id` podem espalhar Gabriel em dois usuários.                                                                                  | Consolidar em um único `app_users` por pessoa.                                                                                                                                   |
| 4   | **Rota está sob `_authenticated**`                              | Abrir link sem login         | O nome "Link individual" sugeria URL pública; hoje precisa de sessão Supabase válida.                                                                                                                                                            | `routes/_authenticated/movimentacao.$slug.tsx` | Se a intenção for permitir Nivia/tatuador abrir sem login, hoje **não funciona**. Confirmar produto.                                                                            | Se público: mover para `src/routes/movimentacao.$slug.tsx` + endpoint público em `api/public/*` + token individual (HMAC/slug+hash). Se sempre autenticado: manter e documentar. |
| 5   | **Nome "Augusto" no config diverge**                            | Comparar config vs. DB       | Config: `"Augusto"`; DB `artists.name`: `"Augusto Santos"`.                                                                                                                                                                                      | `config/movimentacao-slugs.ts:45`              | Cabeçalho do formulário mostra "Augusto"; GHL recebe `artist_name` do DB ("Augusto Santos"). Divergência cosmética.                                                             | Padronizar em "Augusto Santos".                                                                                                                                                  |
| 6   | **Custom object nunca validado**                                | Nenhum registro sincronizado | `app_settings` sem chave; nenhuma requisição real ao GHL foi feita.                                                                                                                                                                              | `movimentacao-ghl.server.ts`                   | Primeiro registro pode falhar por: locationId/token, formato de `dataType` (todos os campos serão criados como TEXT ao vivo?), ou permissão do escopo `objects.readonly/write`. | Executar uma criação dry-run controlada em staging OU criar o schema manualmente no GHL com dataTypes corretos (DATE/CURRENCY/TEXT) antes do primeiro submit.                    |
| 7   | `**referencia`, `ghl_contact_id`, `ghl_opportunity_id` mortos** | Query no DB                  | Colunas existem, código não preenche.                                                                                                                                                                                                            | insertPayload em `createMovimentacao`          | Vinculação com contato/oportunidade do GHL não acontece — pagamento fica "solto".                                                                                               | Decidir se movimentação deve casar com um Contact GHL por telefone/nome antes do POST; se sim, implementar `contacts/search` antes do sync.                                      |
| 8   | **Sem UI para listar histórico**                                | Abrir formulário             | `listMovimentacoes` existe mas nenhuma rota consome.                                                                                                                                                                                             | —                                              | Usuário não vê o que registrou; impossível conferir sem `/admin/movimentacao-links` (que só mostra falhas).                                                                     | Adicionar lista dos últimos N no próprio slug.                                                                                                                                   |
| 9   | **Sem constraint UNIQUE em `chave_idempotencia**` (a confirmar) | —                            | Código faz `select…maybeSingle` antes do insert; sem UNIQUE, race dupla-clique pode inserir 2.                                                                                                                                                   | migration                                      | Duplicidade em picos.                                                                                                                                                           | Verificar/criar `UNIQUE (chave_idempotencia)`.                                                                                                                                   |
| 10  | `**recebido_por` no GHL vai como texto**, não como referência   | payload                      | GHL recebe `recebido_por` como string sem relação.                                                                                                                                                                                               | `movimentacao-ghl.server.ts:152`               | Filtros/relatórios no GHL por dono ficam por texto.                                                                                                                             | OK para MVP; para relatório fino precisará de campo custom relacionado.                                                                                                          |


---

## 8. Partes ainda incompletas

- Vinculação com **Contact** e **Opportunity** do GHL (`ghl_contact_id`, `ghl_opportunity_id`, `referencia`).
- **Cadastro real** da Nivia como `app_user` seller.
- **Deduplicação** dos `app_users` do Gabriel e Augusto.
- **Validação real** do custom object no HighLevel (nunca aconteceu ao vivo).
- Histórico visível ao próprio dono do slug.
- Fechamento diário/relatório filtrando por: data, cliente, tatuador, recebido_por, tipo, forma, status_sincronização (RPC/UI não existe).
- Reconciliação com `appointments` / `payments` já existentes (movimentações vivem em tabela separada).

---

## 9. Diferenças entre solicitado × implementado

- Solicitado "link individual" (público) → **entregue link autenticado**.
- Solicitado "Nivia com link próprio" → **link existe, mas sem `app_users` a Nivia não abre**.
- Solicitado campos `id_contacto`, `id_oportunidade`, `referencia`, `data_hora_registro` → **3 primeiros ausentes**; `data_hora_registro` mapeado em `created_at`.
- Solicitado "duas movimentações por forma" para pagamento misto → hoje é **uma linha com 4 colunas**. Modelagem correta precisa decisão de negócio.

---

## 10. Plano de correção (ordem de prioridade)

Sujeito à aprovação — nada será alterado até você autorizar.

1. **Destravar Nivia**: criar `app_users` com `role='seller'` + `seller_id` correto ou trocar `MOVIMENTACAO_SLUGS.nivia` para apontar a um seller que exista. Sem isto o link fica quebrado.
2. **Consolidar duplicatas** em `app_users` para Gabriel (3 rows) e Augusto (2 rows). Manter um único vínculo por pessoa e apagar duplicados órfãos.
3. **Decidir escopo do link** (público vs. autenticado). Se público: extrair rota para fora de `_authenticated`, criar endpoint `api/public/…` com token/HMAC por slug e revalidar identidade server-side.
4. **Provisionar / validar o custom object no GHL** manualmente com dataTypes corretos (DATE, CURRENCY, TEXT) e gravar o `objectKey` em `app_settings`. Testar 1 submit end-to-end antes de liberar aos artistas.
5. **Adicionar UNIQUE** em `movimentacoes.chave_idempotencia` (se não existir).
6. **Vincular Contact/Opportunity do GHL**: search por telefone/nome antes do POST, gravar `ghl_contact_id`.
7. **Histórico no próprio slug** (últimos N registros do dono).
8. **Relatório de fechamento diário** com filtros pedidos (data, cliente, tatuador, recebido_por, tipo, forma, status).
9. Corrigir nome "Augusto" → "Augusto Santos" no config.
10. Documentar a modelagem de pagamento misto (linha única × múltiplas linhas).

---

## 11. Perguntas para você

1. O link deve ser **público** (qualquer um com o URL registra) ou continuar **autenticado**?
2. Nivia precisa de conta de usuário no app, ou o link dela é um endpoint público token-based?
3. Pagamento misto deve gerar **uma linha** (como hoje) ou **uma linha por forma de pagamento**?
4. Movimentação precisa **casar com um Contact/Opportunity existente no GHL** antes de gravar, ou é aceitável criar sem vínculo?
5. Confirma o `locationId` `9iqrKUVPDddINb9S4Iwd` e que o `GHL_TOKEN` atual tem escopo `objects.write`?
6. Devo apagar/consolidar os `app_users` duplicados (Gabriel e Augusto)?
7. "Recebido por" no relatório precisa filtrar por pessoa (referência) ou por texto basta?

---

## 12. Critérios para "processo financeiro pronto para uso real"

- Todos os 5 slugs abrem sem erro para as pessoas certas (inclui Nivia).
- 1 registro real de cada slug feito end-to-end com `ghl_sync_status='synced'`.
- Custom object `movimentacao_financeira` confirmado no GHL com campos corretos.
- Duplicatas de `app_users` resolvidas.
- `UNIQUE` de `chave_idempotencia` ativo e testado com duplo clique.
- Relatório diário filtrando por data/tatuador/recebido_por/forma disponível.
- Rotina de reprocesso de falhas testada com 1 falha real.
- Definição documentada de "pagamento misto" e "vínculo com Contact/Opportunity".

---

## Resposta final

**O processo financeiro está pronto para uso real?**

**NÃO.**

Bloqueadores atuais:

1. Nivia não tem `app_users` — o link dela lança erro imediato.
2. Zero registros gravados até hoje; a integração com o Custom Object do HighLevel **nunca foi exercitada em produção** e o `objectKey` não está cacheado.
3. Duplicatas em `app_users` (Gabriel × 3, Augusto × 2) tornam `recebido_por_app_user_id` ambíguo.
4. Escopo do link (público × autenticado) ainda não foi confirmado com você — hoje é autenticado, o que contradiz a leitura de "link individual".
5. Vinculação com Contact/Opportunity do GHL ausente (`ghl_contact_id`, `ghl_opportunity_id`, `referencia` sempre nulos).

Aguardando sua autorização e as respostas da Seção 11 para prosseguir com o plano da Seção   
10.  
O link deve ser **público** (qualquer um com o URL registra) ou continuar **autenticado**?  
LINK PUBLICO   
  
Nivia precisa de conta de usuário no app, ou o link dela é um endpoint público token-based?  
enviar convite 


|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Nivia Mendes | [niviamendx@gmail.com](mailto:niviamendx@gmail.com)1PN6UERcCHqwhFpY8RLD Pagamento misto deve gerar **uma linha** (como hoje) ou **uma linha por forma de pagamento**? forma de pagamento Movimentação precisa **casar com um Contact/Opportunity existente no GHL** antes de gravar, ou é aceitável criar sem vínculo? Aceitavel Confirma o `locationId` `9iqrKUVPDddINb9S4Iwd` e que o `GHL_TOKEN` atual tem escopo `objects.write`? SIM Devo apagar/consolidar os `app_users` duplicados (Gabriel e Augusto)? sim se estiver duplicados vamos | +32 465 39 79 41 |
