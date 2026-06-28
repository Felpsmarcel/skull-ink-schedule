# Corrigir traduções cruas na tela

## Diagnóstico

Os componentes chamam `t("agenda.today")`, `t("nav.agenda")`, `t("agenda.booked")`, etc. com `defaultNS: "common"`. Mas os arquivos `src/i18n/locales/{pt,fr,en}.json` estão estruturados como:

```json
{ "common": { "agenda": { "today": "Hoje" }, "nav": {...} } }
```

O loader (`src/i18n/index.ts`) usa a chave de topo de cada bundle como **nome do namespace**: `i18n.addResourceBundle(lng, ns, res, ...)` onde `ns = "common"`. Isso significa que, dentro do namespace `common`, a chave real fica `common.agenda.today` — então `t("agenda.today")` não encontra nada e o i18next devolve a própria chave (`agenda.today`), que aparece em MAIÚSCULAS por causa do `text-transform: uppercase` do botão pílula e da nav inferior. Daí "AGENDA.TODAY", "NAV.AGENDA", e os cards "agenda.booked".

## Correção (1 ajuste, 3 arquivos)

Remover o wrapper `"common"` externo dos três JSONs, deixando as seções (`agenda`, `nav`, `appt`, `actions`, `app`) no nível raiz. Assim `addResourceBundle` registra `agenda`, `nav`, etc. como namespaces — mas como o código sempre usa `t("agenda.today")` (notação de ponto) e `defaultNS = "common"`, vamos manter UM namespace só renomeando o wrapper para que a estrutura final seja:

```json
{
  "app": {...},
  "actions": {...},
  "agenda": {...},
  "nav": {...},
  "appt": {...}
}
```

E ajustar `src/i18n/index.ts` para registrar o bundle inteiro sob o namespace `common`:

```ts
for (const [lng, bundle] of Object.entries(BUNDLES)) {
  i18n.addResourceBundle(lng, "common", bundle, true, true);
}
```

Isso faz `t("agenda.today")` resolver para `common:agenda.today = "Hoje"`, `t("nav.agenda") = "Agenda"`, `t("agenda.booked") = "Reservado"`, `t("agenda.lastUpdate") = "Atualizado"`.

## Arquivos

- `src/i18n/locales/pt.json` — remover wrapper `common`
- `src/i18n/locales/en.json` — idem (verificar/sincronizar chaves)
- `src/i18n/locales/fr.json` — idem
- `src/i18n/index.ts` — registrar bundle inteiro como ns `common` (loop ajustado)

## Verificação

1. Recarregar `/agenda` como Gabriel — deve aparecer "Hoje", "Atualizado", "Agenda/Serviços/Avaliações/Menu" na barra, e os cards com nome do cliente + "Reservado".
2. Conferir que não sobrou nenhuma key crua via Playwright (`page.content()` sem ocorrências de `agenda.` ou `nav.` em texto visível).

## Fora de escopo

- Pagamentos / marcar como pago.
- Drawer de detalhe do agendamento.
- Adicionar novas strings ao catálogo (só corrigir o que já existe).