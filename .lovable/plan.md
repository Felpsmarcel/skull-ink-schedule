## Revisão Final — Sprint 1

Antes de tocar em código, vou fazer uma triagem honesta dos itens que ficaram em aberto da Sprint 1 e classificá-los. Só depois disso decido o que corrigir.

### Itens em revisão

| # | Item | Classificação inicial | Justificativa |
|---|---|---|---|
| 1 | Hydration mismatch em `/auth` (envolvi em `<ClientOnly>`) | **Hipótese** | Não há reprodução pós-fix registrada. Preciso rodar Playwright e comparar HTML SSR vs CSR. |
| 2 | Guard `_admin` redirecionava admin para `/agenda` | **Bug confirmado (já corrigido)** | Causa raiz: `throw redirect` em `beforeLoad` SSR sem sessão. Já trocado por `AdminGate` client-side. Precisa apenas re-validação. |
| 3 | Sub-rotas de `/appointments/new` não renderizavam | **Bug confirmado (já corrigido)** | Causa raiz: faltava layout com `<Outlet />`. Já criado. Precisa re-validação. |
| 4 | URL pollution `?debug=false` em `/agenda` | **Bug confirmado (já corrigido)** | `validateSearch` retornava chave sempre. Precisa re-validação. |
| 5 | i18n misturando EN/PT em `pt-BR` | **Bug confirmado (já corrigido)** | Faltava `load: "languageOnly"`. Precisa re-validação. |
| 6 | Dados demo no Financeiro | **Bug confirmado (já corrigido)** | 3 appointments seed. Já deletados. Re-validação. |
| 7 | `TypeError: Failed to fetch` no console durante navegação | **Hipótese** | Pode ser apenas ruído de navegação cancelada. Precisa reprodução isolada e inspeção de network. |
| 8 | Agenda mostra `0● 0○` em dias vazios | **Melhoria (UX)** | Não é bug — é estado real. Fora do escopo de "fix". |
| 9 | Botões stub no Bottom Nav | **Dívida técnica** | Planejado para Sprint 4. Fora de escopo. |
| 10 | Google OAuth não validado end-to-end | **Dívida técnica** | Requer validação externa fora do sandbox. |
| 11 | Empty state "sem free slots" para artista lotado | **Hipótese** | Não reproduzido. |

### Plano de execução (somente bugs + hipóteses)

**Fase A — Re-validação dos bugs já corrigidos (itens 2, 3, 4, 5, 6)**

Para cada um, rodar script Playwright dedicado e capturar:
- Screenshot da tela em estado esperado
- URL final
- Logs de console (sem erros novos)
- Para item 6: query SQL em `appointments` confirmando 0 registros demo

Se algum falhar → re-classificar como bug ativo e abrir correção com o template (causa raiz / alternativas / solução / impacto / risco).

**Fase B — Investigação das hipóteses (itens 1, 7, 11)**

1. **Hydration `/auth`**: rodar `curl` no HTML SSR + diff contra DOM após hydration via Playwright. Se idêntico → fechar hipótese. Se divergente → promover a bug e corrigir.
2. **`Failed to fetch`**: navegar pelos fluxos principais com `page.on("console")` e `page.on("requestfailed")` ativos. Se for `AbortError` de navegação cancelada → ruído aceito, documentar. Se for request real falhando → promover a bug.
3. **Sem free slots**: simular artista com calendário cheio (ou mock da resposta GHL) e verificar empty state. Se renderizar `--:--` infinito → bug; se mostrar mensagem → fechar.

**Fase C — Correções (somente se Fase A/B confirmar bug ativo)**

Para cada bug confirmado, antes do patch eu apresento:
- **Causa raiz** (com referência de arquivo/linha)
- **Alternativas consideradas** (no mínimo 2)
- **Solução escolhida** + por quê
- **Impacto arquitetural** (rotas, contratos, dados)
- **Risco de regressão** (o que pode quebrar)

Depois aplico, re-rodo Playwright e anexo evidência (screenshot + log).

**Fase D — Relatório final**

Tabela consolidada: item → classificação final → status (resolvido / aceito / promovido a Sprint 2) → evidência. Sprint 1 só é dada como concluída se 100% dos bugs confirmados tiverem evidência verde. **Não inicio Sprint 2 sem nova aprovação tua.**

### O que NÃO farei nesta passada

- Não vou corrigir itens 8, 9, 10 (melhoria / dívida) — entram em sprints próprias.
- Não vou refatorar nada que não esteja na lista acima.
- Não vou tocar em schema do banco a menos que um bug confirmado exija.

Aprovado para executar?
