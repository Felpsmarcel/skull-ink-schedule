# GHL sync — revisão antes da ativação

## Correção do bloqueador de identidade (3 novembro 2026)
- Reproduzida A→B com lookup falho, outra location, upsert falho e IDs divergentes: o código anterior ainda emitia UPDATE.
- Eventos sem contato normalizado, resposta CRM com id/location verificados ou resolução local confirmada são excluídos antes de INSERT/UPDATE; a execução falha e preserva todo o evento anterior.
- Dados locais não substituem verificação CRM; cache só reaproveita contatos verificados nesta execução. Não há fallback após falha de upsert.
- Snapshot completo de B substitui A, inclusive telefone/email nulos. Não altera valores ou percentuais existentes.
- **SQL pendente de incorporação:** `docs/sql/ghl-sync-contact-identity.review.sql` substitui `ghl_sync_write` com lock SHARE do contato e verificação atômica id↔ghl_contact_id e snapshot. O editor recusou alterar o arquivo protegido em `supabase/migrations`; não foi usado o fluxo que aplicaria SQL real. A migração original ainda contém o SQL antigo: NÃO aplicar sem incorporar esta correção pelo fluxo autorizado.
- Testes usam exclusivamente mocks e banco local descartável; nenhuma consulta/importação/alteração de CRM real foi executada nesta correção.
- Validação final: 118 testes passaram e compilação automática OK; inclui B local já existente, resposta vazia/inconsistente do upsert, ID CRM divergente, transição válida limpando dados de A e rejeição SQL sem modificar o evento. API móvel, DST e contrato financeiro mantêm seus testes passando.

## Estado verificado em 3 novembro 2026, 15:18–15:24 UTC
- Lovable Cloud respondeu nas verificações de banco e autenticação.
- Credenciais no servidor: GHL_TOKEN sim; URL e credencial privilegiada do banco sim; GHL_SYNC_SECRET não.
- O token consegue ler calendários (13) e pipelines de oportunidades na subconta confirmada. O endpoint de detalhes da subconta respondeu 401: a identidade explícita do token não ficou comprovada por esse endpoint, embora a leitura com locationId fixo funcione.
- Há 8 calendários vinculados a artistas ativos, todos distintos.
- Três jobs de agenda ativos a cada 10 minutos: sync-ghl-appointments, gf-sync-ghl-appointments-10min e ghl-sync-10min. Nenhum foi alterado.
- Nos últimos 60 minutos: 18 disparos de cron marcados como succeeded. Isso confirma somente enfileiramento HTTP, NÃO conclusão de importação.
- Não existe tabela persistente de execuções concluídas nem registro de sync em app_settings; última sincronização realmente concluída: NÃO VERIFICADA.
- Política efetiva appt_artist_select_all permite leitura de todos os appointments para artistas. Correção foi preparada, não aplicada.

## Diff funcional preparado
- Endpoint /api/public/hooks/sync-ghl: Authorization: Bearer dedicado, comparação segura, sem chave pública ou fallback; segredo ausente retorna 403 antes de carregar o importador; falha parcial retorna 502.
- RPCs administrativas: checagem com context.supabase e JWT do usuário, sem service-role para autorização. SQL nega auth.uid() ausente e papel NULL; não depende de has_role.
- Nova migração supabase/migrations/20261103160000_secure_ghl_sync.sql: tabelas com grants/RLS, lease atômico de 5 minutos, writes protegidos por lease na mesma transação, estados running/succeeded/failed/expired e horário real de conclusão.
- Tempo de execução máximo 4 minutos, GHL e consultas de banco com timeout, leituras e writes em lotes de até 100; nenhum lock depende da memória do servidor.
- Conflitos de calendário/artista são bloqueados antes de enriquecer contatos; validação adicional sob lock antes de atualizar. Calendários precisam pertencer ao catálogo da subconta fixa; nada é inferido do nome do calendário.
- Não há alteração de total, serviços ou comissão existentes. Novos eventos copiam apenas a comissão já configurada no artista, sem fallback de 40%. Valor recebido continua separado de oportunidade ganha.
- Atualização manual invalida agenda, agenda-range, agenda-status e agenda-status-range, inclusive após falha.
- Agenda do artista filtra seu vínculo; status administrativo mostra conclusão verificada e falhas, sem considerar disparo do cron um sucesso de importação.
- Política ampla é removida; guard restritivo mantém artistas em seus próprios appointments e preserva admin/seller.
- Definição futura de cron consolida os três jobs existentes SOMENTE quando schedule_ghl_sync for chamado explicitamente, usando Vault privado em tempo de execução. A migração NÃO chama essa função.

## Preparação pendente (não executar nesta etapa)

### Resultados de validação
- Compilação automática do preview: build OK.
- Testes locais com dados fictícios: autorização privada, isolamento RLS, expiração/fencing, preservação de 650 EUR e comissão configurada de 37%, falha parcial, ausência de calendários/comissão e persistência de conclusão.
- Endpoint exercitado pelo navegador: chamadas sem credencial e com chave pública retornam 403; nenhuma importação foi iniciada.
- Não foram feitas alterações de banco, Vault, jobs, CRM, publicação ou cobranças. Testes de banco usam exclusivamente uma instância local descartável.
- Pagamentos recebidos e oportunidades mantêm fontes separadas; nenhum valor financeiro foi recalculado.

1. Revisar diff e resultados de testes.
2. Solicitar GHL_SYNC_SECRET pelo formulário seguro do editor, com geração e destino claramente identificado; o mesmo segredo precisa ser guardado como ghl_sync_secret no Vault por procedimento seguro autorizado. Não usar chave pública, não colocar valor no SQL versionado ou chat.
3. Aplicar a migração pelo fluxo de migrações autorizado, com conteúdo idêntico ao arquivo versionado; verificar grants/RLS e segredo privado dos dois lados.
4. Publicar a versão segura somente após autorização; substituir os três jobs por um e verificar uma execução controlada com dados reais após autorização de importação.

Até a migração ser aplicada, a nova sincronização manual falha fechada porque as novas RPCs não existem. A versão publicada e os três jobs antigos não foram modificados neste trabalho; continuam exigindo revisão e correção coordenada.

Cadência futura preservada: 10 minutos, 144 chamadas/dia em um único job (em vez de até 432 disparos/dia). É uma reconciliação periódica com atraso de até 10 minutos e custo recorrente; webhook do CRM pode reduzir chamadas futuramente, fora deste escopo.
