# Nova Home operacional antes da Agenda — avaliação de impacto

## Veredito: impacto BAIXO

A mudança é quase 100% por **adição**. Nada da agenda, financeiro, admin ou autenticação precisa ser refatorado. O único ajuste em código existente é para onde o login redireciona e onde a navegação inferior aponta.

## Quanto do código atual muda

Praticamente nada de lógica. Apenas 3 pontos de navegação e 1 rota nova:

- Redirecionamento pós-login: hoje `/` manda o usuário autenticado para `/agenda`; passaria a mandar para `/home`.
- Barra inferior (mobile) e barra do topo (desktop): ganham o item "Home" (a Agenda continua lá).
- Logo do topo hoje leva para `/agenda`; passaria a levar para `/home`.

Todo o resto (agenda dia/semana/mês, wizard de agendamento, financeiro, relatórios, movimentações, onboarding, admin) fica intocado.

## O que já existe e pode ser reutilizado

- **Dados da agenda de hoje**: hook `useStaffDayAgenda` (grade do dia com livre/ocupado) e `useStaffRangeAgenda` — já usados pela Agenda, sem query nova.
- **Status de pagamento por agendamento**: `useDayAppointmentStatuses` (badges pago/pendente).
- **Próximo atendimento**: derivado dos mesmos eventos do dia, ordenando por hora — sem backend novo.
- **Papel do usuário** (`useCurrentUser` / `useIsAdmin`) para mostrar só os atalhos que o usuário tem.
- **Atalhos**: as mesmas rotas já listadas no Menu (financeiro, registrar pagamento, relatórios, equipe, links, reconciliar).
- Componentes visuais já prontos: cartões, `StatusBadge`, `Avatar`, ícones, layout `AuthShell` (topo + navegação inferior herdados automaticamente).
- Resumo financeiro do dia, se quisermos, via `useFinance` existente.

## Arquivos novos

- `src/routes/_authenticated/home.tsx` — a página.
- `src/components/home/*` — 3 a 4 cartões pequenos: resumo de hoje, próximo atendimento, clientes aguardando, grade de atalhos.

## Arquivos existentes modificados

- `src/routes/index.tsx` — destino do redirecionamento autenticado.
- `src/components/layout/bottom-nav.tsx` — item Home.
- `src/components/layout/auth-shell.tsx` — link Home no topo e destino do logo.

(`src/routeTree.gen.ts` é regenerado automaticamente.)

## "Clientes aguardando" e "Check-in"

Esses dois são os únicos pontos sem base pronta hoje: não existe conceito de fila/check-in no sistema. Implementação mínima e segura:

- **Clientes aguardando**: na primeira versão, mostrar os atendimentos de hoje cujo horário já passou ou está em curso e ainda não têm pagamento registrado — usando apenas dados já disponíveis. Nada de tabela nova.
- **Botão "Check-in"**: presente na Home, mas desabilitado com rótulo "em breve" (ou levando a uma tela placeholder) até o módulo ser construído.

## Riscos

- **Agenda**: nenhum — não é tocada.
- **Autenticação**: nenhum — o portão `_authenticated` e o gate de onboarding continuam iguais; a Home fica dentro do mesmo portão.
- **Navegação**: risco baixo e controlado — a Agenda continua acessível por `/agenda` e pela barra inferior; nada de link antigo quebra.
- Ponto de atenção: o gate de onboarding continua obrigando tatuadores novos a concluir o onboarding antes de ver a Home — comportamento desejado, sem mudança.

## Implementação mínima e mais segura (ordem sugerida)

1. Criar `/home` só de leitura, reutilizando os hooks da agenda.
2. Adicionar Home às barras de navegação, mantendo Agenda.
3. Trocar o redirecionamento pós-login para `/home`.
4. Deixar o Check-in como botão "em breve".

Nenhuma migração de banco, nenhuma função de servidor nova, nenhuma alteração de permissões.
