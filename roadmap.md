# Renovação premium

## Correção da data no novo agendamento
- [x] Invalidar somente o horário da sessão cuja data mudou e alinhar o calendário ao trocar de sessão
- [x] Verificar sessão única/múltipla sem confirmar agendamento nem alterar CRM (reprodução autenticada antes/depois, 282 testes, compilação OK, lint dos novos arquivos OK)

## Agenda — etapa 4 autorizada
- [x] Ajustar menu inferior com espaço adicional à área segura e alvos legíveis (48px; área segura de 34px simulada)
- [x] Deslizar na grade diária sem conflitar com rolagem, fichas ou gestos do sistema (toques reais em Chromium; esquerda/direita, vertical e bordas)
- [x] Impedir recarga por overscroll apenas na Agenda e verificar celular/computador sem gravar dados ou publicar (375/393/852/1280px, sessão autenticada, 279 testes, lint dos arquivos novos/menu e compilação OK; Safari em iPhone físico não verificado)

## Agenda — etapa 3 autorizada
- [x] Aplicar tipografia editorial na data, cartões por status e seleção dourada
- [x] Neutralizar avatares e manter preto/dourado nas visões dia, semana e mês
- [x] Verificar celular/computador, abertura das fichas e regressões sem alterar dados ou publicar (375/393/1280px; 276 testes; compilação OK; isolamento autenticado entre artistas não reexecutado)

## Agenda no celular — etapa 2 autorizada
- [x] Compactar data, resumo e controles sem corte horizontal
- [x] Trocar faixa CRM por indicador que abre detalhes, mantendo consulta administrativa somente leitura
- [x] Conferir interação no celular/computador e executar regressões sem publicar (375/393/1280px; 276 testes; compilação OK)

## Revisão final API móvel: completude e homônimos
- [x] Reproduzir página vazia contraditória, IDs/cursor inválidos e fusão de homônimos
- [x] Corrigir paginação e agregação por IDs imutáveis CRM/app sem zeros substitutos
- [x] Atualizar contrato e validar regressões fictícias/compilação sem produção (179 testes; compilação automática OK)

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