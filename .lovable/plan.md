## Objetivo

Adicionar 2 elementos à página `/movimentacao/$slug` sem tocar em campos, validações ou lógica de submit existentes.

## Mudanças

### 1. `src/routes/movimentacao.$slug.tsx` — botão "Histórico" no header

No header (linha com nome do recebedor), adicionar à direita um `<Link to="/movimentacao/historico">` discreto com ícone `Clock` (lucide) + texto "Histórico". Cinza (`text-muted-foreground`), sem fundo/borda, `text-xs`. Layout do header vira `flex items-center justify-between`.

Nota: a rota `/movimentacao/historico` ainda não existe — o link vai renderizar mas dar 404 até ser criada. Isto é intencional conforme o pedido ("NÃO criar nova rota aqui").

### 2. `src/components/movimentacao/movimentacao-form.tsx` — tela de confirmação pós-submit

Substituir o atual bloco `lastResult` (banner verde) por um **modo confirmação** que troca o form inteiro. Toda a lógica de submit, validação e mutação permanece intacta.

**Estado**: expandir `lastResult` para guardar snapshot do registo criado:
```ts
{ id, synced, ghl_status, nome_cliente, artistName, tipo, metodo, total, criado_em }
```
Preenchido em `onSuccess` a partir de `res` + valores do form antes do reset. `artistName` resolvido via lookup em `artists` pelo `artist_id`. `metodo` derivado do campo com valor > 0 (cartão / dinheiro / sumup / transferência / misto se >1).

**Render condicional**: se `lastResult` existe → renderiza `<ConfirmationScreen />` no lugar do `<form>`; senão renderiza o form como hoje.

**ConfirmationScreen** (novo componente inline no mesmo arquivo):
- Card `bg-card rounded-xl shadow-sm p-6` (mesma largura do form)
- Ícone: `CheckCircle2` verde `#16a34a` se `ghl_status === "synced"`, senão `AlertTriangle` âmbar `#d97706`
- Título correspondente ("Pagamento registado!" / "Guardado — sincronização pendente")
- Tabela resumo (Cliente / Tatuador / Tipo / Método / Total) usando `<dl>` com `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5`
- Texto pequeno cinza: `Registado em ${formatDate} às ${HH:MM}` (usa `formatDate` de `@/lib/format` + `toLocaleTimeString` pt-PT)
- Link `<a href="/movimentacao/historico?highlight=${id}">→ Ver no histórico</a>` (âncora HTML simples, cinza)
- Botão primário "Novo registo": `setLastResult(null)` + `setForm(initialState(context))` — o `initialState` já usa `context.defaultRecebedorId` derivado do slug, então "Recebido por" volta pré-preenchido automaticamente

### Backend: o `id` e `ghl_sync_status` do registo criado

`createMovimentacao` em `src/lib/movimentacao.functions.ts` já retorna `{ id, ghl_sync_status, ... }` (usado hoje no `onSuccess`). Nenhuma alteração de servidor necessária. Se `id` não estiver no retorno atual, adiciono-o ao `select` do insert — a verificar ao ler o arquivo em build mode.

## Fora de escopo

- Criar rota `/movimentacao/historico` (pedido explícito)
- Alterar campos, labels, validações, mutação, GHL sync
- Retirar o `qc.invalidateQueries` / `haptic` / `toast` existentes (mantidos)

## Aparência (ASCII)

```text
┌─────────────────────────────────────┐
│ Registro de pagamento               │
│ Gabriel                  🕐 Histórico│
└─────────────────────────────────────┘

── após submit ──
┌─────────────────────────────────────┐
│  ✓  Pagamento registado!            │
│                                     │
│  Cliente    Luciene Caberlin        │
│  Tatuador   Andre Pareyn            │
│  Tipo       Saldo                   │
│  Método     SumUp                   │
│  Total      € 1.700,00              │
│                                     │
│  Registado em 22/07/2026 às 00:56   │
│                                     │
│  → Ver no histórico                 │
│  [    Novo registo    ]             │
└─────────────────────────────────────┘
```
