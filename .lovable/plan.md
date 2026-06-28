
# Validação Sprint 1 — Relatório Real (Playwright + localhost:8080)

Credenciais usadas: `admin@gftattoo.test / Admin#2026` e `gabriel@gftattoo.test / Artist#2026`. Viewport mobile 430×900.

## 1. Rotas de novo agendamento

Todas renderizam o componente correto, sem console error, sem network failed, sem pageerror.

| Rota | Arquivo | Estado esperado | Resultado real |
|---|---|---|---|
| `/appointments/new` | `src/routes/_authenticated/appointments.new.index.tsx` | Form completo (cliente, tatuador, data, slots, serviços, footer) | ✅ h1 "NEW APPOINTMENT", footer com 3 botões, 8 botões no total, sem erros |
| `/appointments/new/services` | `src/routes/_authenticated/appointments.new.services.tsx` | Catálogo agrupado por categoria | ✅ h1 "PICK SERVICE", 3062 chars no body, sem erros |
| `/appointments/new/checkout` | `src/routes/_authenticated/appointments.new.checkout.tsx` | Contato + data + serviços + total + footer | ✅ h1 "DETAIL / CHECKOUT", footer com "Pay now" + "Finalize", sem erros |

Layout wrapper `appointments.new.tsx` (apenas `<Outlet />`) está plugado corretamente — confirmado pelo fato de as 3 telas renderizarem.

Observação lateral (não-bloqueante): i18n está caindo no namespace `en` mesmo com `<html lang="pt">`. Pré-existente; não regressão da Sprint 1.

## 2. Guard Admin — REGRESSÃO

| Pergunta | Resposta |
|---|---|
| Admin acessou `/ghl-test`? | ✅ Sim — URL `/ghl-test`, h1 "GHL — TESTE" |
| Artist redirecionado? | ❌ **NÃO** — URL ficou em `/ghl-test` e a página mostra **"This page didn't load — Something went wrong on our end"** (error boundary). |
| Race condition após login? | Não detectada |
| Erro de auth? | Não — login do Gabriel funcionou (`/agenda?debug=false`) |

Console mostra: `Error in route match: __root__/` e `The above error occurred in the <AdminGate> component. React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundaryImpl.`

Causa raiz: `throw redirect(...)` chamado **dentro do render** de um componente é tratado pelo TanStack Router como erro normal (a redirect-as-throw só é interceptada em `beforeLoad` / `loader`). Resultado: o usuário Artist vê a página de erro do app, em vez de ir limpo para `/agenda`.

## 3. Hydration em `/auth`

| Cenário | Resultado |
|---|---|
| Abrir `/auth` | ✅ Sem pageerror, sem console.error, sem hydration mismatch (carregamento via `<ClientOnly>`/`ssr:false` funcionando) |
| Senha errada | ✅ Mostra "Invalid login credentials" inline, sem redirect |
| Senha correta (admin) | ✅ Vai para `/agenda?debug=false`, sem flash |
| Logout (limpar `sb-*` + voltar) | ✅ Cai em `/auth` |

A hydration mismatch antiga (`__gcrremoteframetoken`) que aparece nos logs do navegador da preview vem de uma extensão/serviço externo injetado na preview hospedada — **não reproduz** no localhost. Considerado resolvido para o app.

## 4. Validação do rascunho (botões disabled)

Draft vazio em `/appointments/new`:

| Botão | Estado | Esperado | Correto? |
|---|---|---|---|
| Add client | enabled | enabled | ✅ |
| Pick an artist | enabled | enabled | ✅ |
| Data picker | enabled | enabled | ✅ |
| Add service | enabled | enabled | ✅ |
| **Checkout** | **disabled** | disabled | ✅ |
| **Save** | **disabled** | disabled | ✅ |

Em `/appointments/new/checkout` com draft vazio:

| Botão | Estado | Esperado | Correto? |
|---|---|---|---|
| **Finalize** | **disabled** | disabled | ✅ |
| Pay now | enabled | — (é só stub `toast(comingSoon)`) | Aceitável |

Campos obrigatórios efetivos hoje:

- `Save` exige: `contact` + `calendarId` + `startISO` (não exige serviço — salva agendamento sem serviço com duração 60 min default).
- `Checkout` exige: tudo do Save + pelo menos 1 serviço.
- `Finalize` exige: contact + calendarId + staff resolvido + startISO + ≥1 serviço.

⚠️ Decisão pendente: o `Save` permitir agendamento sem serviço foi intencional na Sprint anterior. Se a regra for "serviço sempre obrigatório", precisa apertar `canSave`.

## 5. Arquivos alterados na Sprint 1

| Arquivo | O que mudou | Por quê | Impacto | Risco regressão |
|---|---|---|---|---|
| `src/routes/_authenticated/appointments.new.tsx` | Reduzido a layout wrapper (`<Outlet />`) | Sem Outlet, `/services` e `/checkout` não renderizavam | Sub-rotas voltam a montar | Baixo |
| `src/routes/_authenticated/appointments.new.index.tsx` | Novo leaf com o form (movido do antigo `.tsx`) + `canSave`/`canCheckout` + `disabled` nos botões | Separar layout do leaf; impedir submit com draft inválido | URL `/appointments/new` mantém-se | Baixo — testado |
| `src/routes/_authenticated/appointments.new.checkout.tsx` | `canFinalize` + `disabled={saving || !canFinalize}` | Impedir Finalize com draft inválido | Bloqueia chamada inválida ao GHL | Baixo |
| `src/routes/_authenticated/_admin/route.tsx` | Trocou guard server-side por `AdminGate` client (`useCurrentUser` + `throw redirect`) | Evitar race 401/403 que bloqueava Admin | **Admin ok, mas Artist agora cai em error boundary em vez de redirect** | **ALTO — regressão confirmada** |
| `src/routes/auth.tsx` | `ssr:false` + `<ClientOnly>` ao redor de `AuthPage` | Eliminar hydration mismatch | Login funciona, sem flash | Baixo |

## 6. Resultado final

- Sprint 1 aprovada? **Não.**
- Confiança: **70%** (4 de 5 itens OK; AdminGate quebrou o caso "não-admin").
- Bugs remanescentes:
  1. **CRÍTICO** — `AdminGate` lança `redirect()` dentro de render; TanStack trata como erro e mostra "This page didn't load" para Artist em `/ghl-test`. Precisa hotfix antes da Sprint 2.
  2. **Médio** — i18n carregando inglês em vez de pt-BR (pré-existente, fora do escopo da Sprint 1, mas degrada UX).
  3. **Baixo/decisão** — `Save` em `/appointments/new` aceita agendamento sem serviço. Confirmar regra.

## Hotfix proposto (a executar em build mode antes da Sprint 2)

Trocar o render-time `throw redirect` por um gate baseado em `beforeLoad` que consulta a sessão Supabase + perfil, ou um padrão `useEffect`+`navigate` com fallback null:

```tsx
// src/routes/_authenticated/_admin/route.tsx
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminGate,
});

function AdminGate() {
  const { data, isLoading, isError } = useCurrentUser();
  const navigate = useNavigate();
  const isAdmin = data?.role === "admin";

  useEffect(() => {
    if (!isLoading && (isError || !isAdmin)) {
      navigate({ to: "/agenda", replace: true });
    }
  }, [isLoading, isError, isAdmin, navigate]);

  if (isLoading || !isAdmin) return null; // sem flash de conteúdo admin
  return <Outlet />;
}
```

Alternativa mais limpa (preferida se aprovada): mover a checagem para `beforeLoad` do route `_admin` consumindo a sessão + perfil via `context.queryClient.ensureQueryData(...)` — isso devolve o comportamento server-friendly de redirect, sem render boundary. Custo: precisa expor `getMyProfile` como queryOptions reutilizável.

Após o hotfix, re-rodar exatamente os mesmos 4 blocos de Playwright (rotas, guard, hydration, botões) e só então abrir Sprint 2.

Nenhuma outra alteração será feita nesta etapa.
