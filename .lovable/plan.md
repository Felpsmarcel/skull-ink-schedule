## Objetivo
Adicionar o serviço **"Randevu"** com custo **€0** ao catálogo, para que apareça na tela **Selecionar serviço** e possa ser escolhido em um agendamento.

## O que fazer

1. **Inserir 1 linha na tabela `services`** (Lovable Cloud) com:
   - `name`: `Randevu`
   - `category`: `Consulta` (para agrupar no topo da lista)
   - `duration_min`: `30` (padrão razoável — ajustável depois)
   - `modality`: `presencial`
   - `price_eur`: `0`
   - `price_max_eur`: `null` (preço fixo, sem faixa)
   - `description_short`: `Encontro inicial sem custo`
   - `active`: `true`
   - `sort_order`: `0` (aparece primeiro na categoria)

Nenhuma mudança de código é necessária — a tela `/appointments/new/services` já lê de `services` via `fetchActiveServices()`, agrupa por categoria e formata `€0,00` automaticamente via `formatPriceRange`.

## Perguntas rápidas (posso assumir defaults se preferir)
- **Duração**: 30 min está ok? (posso usar 15, 45, 60…)
- **Categoria**: usar `Consulta` (nova) ou encaixar em uma categoria existente do catálogo?
- **Descrição curta**: manter `Encontro inicial sem custo` ou outra?

Se responder "pode ir com os defaults", executo o insert na próxima etapa.
