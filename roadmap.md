# Renovação premium

## Revisão final API móvel: completude e homônimos
- [ ] Reproduzir página vazia contraditória, IDs/cursor inválidos e fusão de homônimos
- [ ] Corrigir paginação e agregação por IDs imutáveis CRM/app sem zeros substitutos
- [ ] Atualizar contrato e validar regressões fictícias/compilação sem produção

## Fechamento complementar antes de clientes móveis
- [x] Validar envelope/events e identidade exata; desativar backfill sem fencing
- [x] Isolar dia/semana/mês e negar usuário sem vínculo
- [x] Preparar proxy fail-closed fora da pasta de deploy automático; testar config/JWT/role/location/calendários
- [x] Validar regressões fictícias e documentar pendências sem produção (161 testes; compilação OK)
- [ ] Incorporar substituto no proxy legado — bloqueado por autorização de deploy, proibido nesta etapa; versão atual permanece vulnerável

## Bloqueador de identidade de contato
- [x] Reproduzir A→B com lookup falho, outra subconta e upsert falho
- [x] Excluir eventos sem identidade normalizada/resolvida e validar vínculo no SQL de revisão versionado
- [x] Confirmar preservação dos dados anteriores e regressões sem executar migrações reais (118 testes)
- [ ] Incorporar SQL de revisão na migração protegida — editor bloqueia edição direta; fluxo disponível aplicaria SQL real, não autorizado nesta etapa

## Sincronização segura do CRM (prioridade atual)
## Ponte de leitura para APK (etapa atual)
- [x] Validar períodos Europe/Brussels e completude de agregados CRM/app
- [x] Negar papéis desconhecidos/sem vínculo e isolar dados financeiros de artistas
- [x] Preparar API JSON de leitura com sessão verificada, sem aplicar migrações ou publicar
- [x] Testar 401/403, escopo A/B, DST, paginação e documentar contrato/dependências do APK
- [ ] Integração real no APK — bloqueada por cliente móvel com sessão/PKCE autorizado e nova geração HighLevel indisponível

- [x] Verificar estado atual, credenciais, leitura da subconta, cron e ausência de evidência de conclusão
- [x] Proteger endpoint privado, preservar JWT admin e preparar permissões limitadas
- [x] Preparar trava atômica, limites de tempo, resultados reais e conflitos de propriedade
- [x] Atualizar indicadores e invalidação da agenda; testar com dados fictícios
- [x] Apresentar diff e resultados em docs/ghl-sync.md sem aplicar migrações, importar ou publicar
- [ ] Ativar sincronização segura — bloqueado por revisão/autorização e configuração do segredo compartilhado; fora da etapa atual

- [x] Definir direção visual Luxury Noir
- [x] Atualizar tokens, fontes e componentes compartilhados
- [x] Renovar navegação e autenticação
- [x] Renovar Home e o cabeçalho do agendamento
- [x] Renovar financeiro e relatórios
- [x] Renovar o menu operacional
- [x] Validar visual mobile/desktop e compilação
- [ ] Renovar Agenda, pagamentos, administração, Totem e páginas públicas