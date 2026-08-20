# Incluir Miguel Marquezine como tatuador

## Resultado esperado

- Aparece na **Agenda** (coluna/calendário próprio, com os agendamentos dele vindos do CRM).
- Aparece no seletor **Tatuador** do formulário de Registrar pagamento (e no filtro do relatório).
- Aparece em **Recebido por** e **Quem está a registar?**.
- Tem **link próprio** de registo: `https://gftattoocalendar.com/movimentacao/marquezine`.
- Recebe convite de acesso por e-mail: `negociosmiguelferreira@gmail.com`.

## Pendência para começar

Falta o **ID do calendário no CRM** dele. Sem esse ID ele fica selecionável nos pagamentos, mas a Agenda dele aparece vazia. Comissão assumida: **40%** (igual aos outros) — diz se for diferente.

## Passos

1. **Cadastro do artista**: criar registo em `artists` com nome "Miguel Marquezine", `active = true`, `commission_pct = 40`, `email` acima e `ghl_calendar_id` = ID informado (e `ghl_user_id` se vier junto). Com isso ele entra automaticamente na Agenda e na lista de tatuadores dos pagamentos (ambas leem a tabela `artists`).
2. **Convite de acesso**: enviar convite pelo fluxo existente de equipe, criando o `app_users` com papel `artist` ligado ao novo `artists.id`. Ao definir a senha ele cai no onboarding normal.
3. **Recebedor + link próprio**: adicionar `marquezine` em `src/config/movimentacao-slugs.ts`:
   - `MOVIMENTACAO_SLUGS` / `MOVIMENTACAO_SLUG_LIST` (kind `artist`, novo `artistId`);
   - `STAFF_RECEBEDORES` / `STAFF_RECEBEDOR_IDS` (com o `app_users.id` criado no passo 2);
   - `SLUG_DEFAULT_RECEBEDOR`: `marquezine → marquezine`.
   A lista "Quem está a registar?" usa a mesma configuração, então passa a incluí-lo.
4. **Verificação**: abrir a Agenda (ele deve constar entre os tatuadores), abrir `/movimentacao/marquezine` (recebedor default correto, ele na lista de tatuadores) e conferir o card do link em `/admin/movimentacao-links`.

## Notas técnicas

- Só a Agenda depende de `ghl_calendar_id` não nulo (`useArtists` filtra calendários nulos); o select de pagamentos usa `listArtistsForSelect`, que não exige calendário.
- Sem alteração de RLS, GRANTs ou schema — apenas dados novos + a lista fechada de slugs/recebedores.
