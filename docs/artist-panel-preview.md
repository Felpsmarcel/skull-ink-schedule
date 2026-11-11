# Painel André — incremento de prévia, 11/11/2026

## Implementado
- `/painel-tatuador`: função GET autenticada verifica app_users do usuário antes das consultas privadas; somente admin nesta versão. ID padrão de André foi confirmado por SELECT. Seleção administrativa aceita apenas artista ativo lido e validado. Appointments e projetos são paginados e filtrados no servidor por artist_id.
- Hoje, próximos 30/60/90 dias, projetos ativos, conclusões explicitamente registradas, datas vinculadas, próxima data e continuidade a verificar. Sem check-in amplo, sem inferência de chegada, tatuagem/cobertura ou Won. Hubaux permanece um projeto com três compromissos; consulta fora.
- Detalhe administrativo de Projeto separa referência comercial e caixa. Hubaux: 2700 EUR integral, 450 EUR informado, 2250 EUR saldo indicativo; zero movimentações, caixa 0 EUR e saldo por movimentações 2700 EUR. Sinal vem da anotação do projeto; não é uma conciliação automática do payment da consulta. Se houver movimentos ou falha de fonte, saldo indicativo fica A conciliar. Não deduzir duas vezes.
- Novo painel não lê ou devolve financeiro, comissão, contatos completos ou oportunidade; detalhes e ações anteriores permanecem sob contratos existentes.

## Arquivos
- `src/lib/artist-panel-core.ts`: autorização de liberação, limites civis Brussels, continuidade e apresentação comercial pura.
- `src/lib/artist-panel.functions.ts`: leituras admin-only, sem cliente privilegiado ou chamadas GHL.
- `src/routes/_authenticated/painel-tatuador.tsx`: nova tela e metadados próprios.
- `src/components/project-commercial-summary.tsx`: fonte comercial e caixa separados.
- `src/routes/_authenticated/projetos.$projectId.tsx`: inclusão administrativa do resumo; cálculos e parcela anterior intactos.
- `src/routes/_authenticated/home.tsx`: somente link administrativo Painel André.
- `tests/unit/artist-panel.test.ts` e `artist-panel-server.test.ts`: 30 testes adicionais sintéticos.
- `AGENTS.md`, `roadmap.md` e este relatório: decisão e pendências.

## Verificado
- `bunx vitest run tests/unit`: 30 arquivos, 356 testes passaram (30 novos). Inclui admin, artista André/outro/sem vínculo, seller/desconhecido, filtro adulterado, fontes parciais, 3 compromissos versus consulta, múltiplos projetos, DST 23/25h e não dupla dedução.
- ESLint direcionado aos novos módulos, componente, rota e testes: passou. Não executado lint geral; apontamentos anteriores da ficha/Home não tratados neste escopo.
- Compilação/tipos automática: último registro build OK em 11/11/2026 03:27:30 UTC. Não executado build manual.
- Playwright com sessão administrativa real: painel André abriu, filtro de 30 dias funcionou, retorno a 60 dias, Home → painel → projeto Hubaux. Valores comerciais e caixa lidos pela UI; projeto com 3 datas confirmado. 393px sem overflow horizontal; visual desktop 1280px e mobile 393px inspecionado. Nenhuma ação de escrita acionada.
- Impeccable aplicado como disciplina de hierarquia, leitura, estados e controles; sem CLI.

## Bloqueios e riscos
- Políticas atuais `appt_artist_select_all` e `tattoo_projects_select_staff` permitem leitura ampla. Não foram alteradas. Novo painel recusa artistas no servidor e nenhum link Meu painel foi liberado para artistas. Não alegar isolamento global; endurecimento e teste real entre duas identidades dependem de autorização separada.
- Financeiro segue pendente de ponte auditável payment ↔ projeto ↔ caixa. Nenhum recebimento, repasse ou comissão novo. Não confirmado tipo de projeto ou status comercial GHL.
- Preservados pagamentos, movimentações, percentuais, datas/status, booking, Totem, Meu Dia, GHL, calendários, políticas e schema. Sem publicação.

Prévia: https://id-preview--03a6f57d-9b2a-4876-a3b5-a886d4f4b51d.lovable.app/painel-tatuador