# Corrigir i18n não inicializado (chaves cruas tipo `appt.cta.selectTime`)

## Causa raiz
`package.json` define `"sideEffects": false`. Isso autoriza o bundler a remover qualquer `import "@/i18n"` que não use exports — exatamente o caso em `src/routes/__root.tsx` e nas rotas. Sem o side-effect, `i18n.use(initReactI18next).init(...)` não roda no cliente, então:
- `useTranslation()` não acha instância → emite o warning `NO_I18NEXT_INSTANCE`.
- Os componentes renderizam a chave literal (`appt.cta.selectTime`, `appt.checklist.client`, etc.).

## Correção (mínima e segura)
1. **`package.json`** — trocar `"sideEffects": false` por uma allowlist que preserve i18n e CSS, mantendo o tree-shaking para o resto:
   ```json
   "sideEffects": ["src/i18n/**", "src/styles.css", "**/*.css"]
   ```
2. **`src/i18n/index.ts`** — defesa em profundidade: exportar uma função `ensureI18n()` que retorna a instância, e chamá-la a partir de `__root.tsx`. Assim o módulo passa a ter um export usado de fato, e mesmo se a allowlist falhar no futuro o init não some.
3. **`src/routes/__root.tsx`** — substituir `import "@/i18n"` por `import { ensureI18n } from "@/i18n"; ensureI18n();` no topo do módulo.

Nenhuma outra rota precisa mudar — basta o root chamar `ensureI18n()` antes do primeiro `useTranslation`.

## Validação
- Recarregar `/appointments/new`: o botão deve mostrar "Selecionar horário" (PT) em vez de `appt.cta.selectTime`.
- Console: warning `NO_I18NEXT_INSTANCE` desaparece.
- Trocar idioma (se houver UI) continua funcionando porque o singleton é o mesmo.

## Fora de escopo
- Nenhuma mudança em lógica de agendamento, rotas, GHL ou Supabase.
- Nenhuma alteração nos arquivos de tradução (`pt.json` / `fr.json` / `en.json`).
