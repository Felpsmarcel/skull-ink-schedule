
## O problema

Hoje o valor só pode ser sobrescrito quando o serviço está marcado como "sob consulta". Para tatuagens normais, o preço vem fixo do catálogo — o tatuador precisa poder ajustar (subir, descer, cobrar um valor combinado com o cliente) sem ter que alterar o serviço em si.

O `appointment-draft` store **já suporta** `overridePriceEur` para qualquer linha (a função `linePriceEur` respeita override em todos os casos). Falta só expor isso na UI.

## O que eu faria (UX)

Na tela de **Novo agendamento**, cada serviço adicionado passa a mostrar o valor como um **campo editável inline**, não texto estático:

```text
┌──────────────────────────────────────────┐
│ Realista braço fechado                   │
│ 180 min · Sessão                         │
│                          [ 450,00 € ]  🗑│
│                          ↑ editável       │
└──────────────────────────────────────────┘
```

- Toque no valor → vira input numérico com teclado numérico (`inputMode="decimal"`).
- Preenchido com o preço de catálogo por padrão; o tatuador ajusta livremente.
- Se ele alterar, mostra um pequeno indicador "editado" (preço original riscado ao lado, tipografia pequena) — assim ele sabe que fugiu do catálogo.
- Botão "Restaurar" (ícone pequeno de undo) aparece só quando há override, para voltar ao preço do catálogo.
- Serviços "sob consulta" continuam com o mesmo campo, só que iniciam vazios (comportamento atual preservado).

O campo de **desconto %** e o de **sinal pago** continuam no checkout — a edição de valor unitário é o que sobe pra tela de criação porque é onde o tatuador está fechando a combinação com o cliente.

## Alterações técnicas

**1 arquivo tocado, sem mudanças de schema, sem novas dependências.**

`src/routes/_authenticated/appointments.new.index.tsx` (bloco "Serviços", linhas ~320-350):
- Substituir o `<span>{formatPrice(l.service.price_eur)}</span>` por um input controlado usando `linePriceEur(l)` como valor exibido e `draft.setOverridePrice(id, v)` no `onChange`.
- Input estilo "ghost" (sem borda até tocar), largura fixa ~90px, alinhado à direita, `inputMode="decimal"`, sufixo "€".
- Quando `l.overridePriceEur != null && l.overridePriceEur !== l.service.price_eur`, mostrar o preço original riscado acima em `text-[10px] text-muted-foreground` + botão restaurar.
- Reutilizar `linePriceEur` de `@/stores/appointment-draft` (já exportado).

O checkout **não muda** — ele já lê `linePriceEur` e já mostra desconto/sinal/saldo corretamente.

## Fora de escopo

- Editar duração da sessão (fica pro catálogo).
- Editar nome/serviço arbitrário sem estar no catálogo (seria "serviço livre" — proponho num passo futuro se você quiser).
- Salvar o novo preço de volta no catálogo (é override por agendamento, não altera o serviço).

## Pergunta rápida antes de implementar

Quando o tatuador editar o valor, o **desconto %** que existe no checkout deve:
- **(a)** continuar aplicando por cima do valor editado (ex: editou pra 500€, aplica 10% → 450€), OU
- **(b)** ser removido/escondido automaticamente já que o preço foi ajustado manualmente?

Meu default seria **(a)** — é o comportamento atual e é mais flexível. Confirma?
