# Ponte de leitura para APK HighLevel — preparação, não ativação

## Diagnóstico atual
Em 3 novembro 2026 (15:29 UTC), Lovable Cloud respondeu normalmente para banco e autenticação. Não houve publicação, aplicação de migrations, importação, alteração do CRM, mensagens ou cobranças nesta etapa. Nenhum serviço novo foi habilitado; a autenticação e o MCP já existiam. A extração do catálogo MCP confirmou quatro ferramentas, não a implantação da revisão.

A leitura de calendários e pipelines da subconta fixa foi verificada na etapa anterior; detalhes da identidade do token retornaram 401. Não se declara identidade completa comprovada, sincronização concluída ou integração fim a fim. Os três crons antigos permanecem como antes; a migração de sincronização segura continua apenas versionada e exige revisão/configuração do segredo privado.

## Contrato preparado
`GET /api/public/mobile-dashboard?from=2026-10-25&to=2026-10-25`

Header: `Authorization: Bearer <access token de usuário desta aplicação>`.
O símbolo acima descreve o contrato, não um segredo para copiar. Nenhum token é aceito no URL, cookie do portal ou identificador enviado pelo cliente. O servidor verifica o token em Auth (`getUser`) e consulta o papel e vínculo com o token verificado, preservando RLS. Sem chave privilegiada para leituras.

- Somente `from` e `to`, datas civis YYYY-MM-DD, intervalo inclusivo de 1–93 dias.
- Parâmetros adicionais (inclusive artistId, userId, locationId), duplicados ou datas inválidas: 400.
- Sem sessão / token inválido: 401.
- Papel desconhecido, seller, perfil ausente ou artista sem vínculo ativo/calendarId/ghl_user_id: 403.
- Falha geral de leitura/configuração: 503; falha parcial de fonte retorna payload parcial sem zeros substitutos.
- Respostas: `Cache-Control: private, no-store`, `Vary: Authorization`.
- Nenhum endpoint de escrita foi adicionado; não há CORS aberto. APK nativo não exige CORS. Um webview de outra origem exige origem exata/configuração adicional; ainda não configurada.

### Envelope JSON
- `fetchedAt`: horário de término da consulta ao vivo, NÃO última sincronização importada.
- `period`: `from`, `to`, `timezone: Europe/Brussels`, `startUtc`, `endExclusiveUtc`, `endExclusive: true`.
- `source`: agenda/opportunities do CRM; pagamentos de `app_movimentacoes`.
- `partial`: true se alguma fonte não é comprovadamente completa.
- `appointments`: `complete`, `truncated`, `count` completo ou null, `items` (máximo 200), `itemsTruncated` separado do truncamento da fonte. Itens somente id, início/fim e status; sem nome, telefone, e-mail ou título do cliente.
- ADMIN: `opportunities.summary` com agregado apenas quando completo; pagamentos registados do app separados, nunca usados como prova de transação bancária/recebimento no CRM.
- ARTISTA: contagens/status próprios sem valor monetário bruto, parcela do estúdio ou comissão. `financialEligibility: not_proven`, `commissionOmitted: true`. O endpoint não consulta pagamentos administrativos para esse papel.

### Precisão
O dia 29/03/2026 tem 23 horas em Bruxelas e 25/10/2026 tem 25. Os limites são meia-noite civil local convertida para UTC e próxima meia-noite exclusiva; não se soma 24h para terminar um dia DST.
Oportunidades são filtradas por **data de criação**, não data em que foram ganhas, pagas ou atualizadas. São valores de oportunidades, não recebimentos. Pagamentos do app usam `data_pagamento` (coluna date), sem inventar UTC para essa data civil.
A paginação CRM percorre os cursores sem presumir ordem de criação, deduplica IDs e verifica assignedTo novamente no servidor. Limite de 25 páginas/25 segundos; ao atingir teto, cursor inconsistente, erro ou falta de prova de término, sinaliza truncamento e totais null. Não calcula totais de amostras.
Agenda CRM não fornece paginação comprovada nesta integração: sinaliza possível teto quando há 100+ eventos, nextPage ou total maior que os eventos; não declara contagem completa nesse caso.
Pagamentos do app paginam em blocos de 500 com contagem exata, ordenação estável e teto de 25.000; mudança de contagem/erro/teto/valor inválido torna o agregado incompleto e valor null. Não resolve atomicidade entre múltiplas consultas concorrentes: contagem estável não equivale a snapshot financeiro transacional.
Comissões contratuais existentes não foram alteradas. Não foi implementada estimativa de comissão: precisa de base elegível e vínculo financeiro comprovados antes de expor valores ao artista.

## O que o APK precisará mudar
1. Substituir o módulo que lê históricos empacotados por fetch autenticado para este contrato.
2. Obter uma sessão compatível desta aplicação. Token do Client Portal HighLevel NÃO é presumido um JWT válido desta aplicação. Precisa de login ou autorização OAuth/PKCE adequada ao cliente móvel; registrar cliente, redirect/deep link e confirmar fluxo exige autorização/configuração adicional. Nenhum fluxo foi inventado ou habilitado nesta etapa.
3. Guardar sessão em SecureStore/armazenamento seguro nativo, renovar tokens e tratar 401 como sessão expirada, 403 como acesso negado. Jamais embutir service key, segredo de cron ou chave única compartilhada como autorização de dados.
4. Mostrar fonte, período/fuso, horário de consulta e incompletude; não apresentar null como 0, nem fetchedAt como horário de importação.
5. Testar login, renovação, deep link e leituras A/B no APK real depois de autorização.

**Bloqueio externo:** APK já baixado não muda com alterações do backend; HighLevel informou que outra geração de APK ainda não está disponível. Não existe entrega fim a fim confirmada.

## Diff preparado e verificação
- Novos `dashboard-period`, `dashboard-scope`, `dashboard-read.server`, `dashboard-api.server` e rota somente GET.
- MCP scope deixa de cair em admin quando papel é unknown/sem vínculo; ferramentas compartilham filtros e projeções seguras.
- CRM: intervalos Brussels, timeout, dedupe/cursores, filtro local de atribuição, supressão de totais incompletos.
- Pagamentos: paginação além do teto padrão 1000, sinalização de incompletude.
- Agenda: fim do dia e avanço por dias civis corrigidos para DST.
- Testes fictícios: API 401/403/400, artista A/B, omissão monetária, DST 23/25 horas, paginação completa 1.201 pagamentos, totais truncados e regressões de sincronização.
- Compilação automática: build OK; 103 testes passaram. Navegador local confirmou 401 sem token e com token inválido, sem dados retornados. Catálogo MCP extraído com quatro ferramentas.
- Leitura autenticada real com contas admin/artista e integração no APK não executadas nesta etapa: exige autorização do fluxo/sessão e cliente móvel disponível. Validação atual é fictícia e de recusa sem sessão; não é prova fim a fim.

## Dependências antes de ativação
Revisão deste diff; autorização para migração de sync e segredo privado/Vault; publicação coordenada somente depois de autorização; cliente móvel compatível com sessão/PKCE e nova entrega APK pela HighLevel; teste autenticado real antes de declarar integração concluída. Migração segura não foi aplicada nem cron novo ativado.
