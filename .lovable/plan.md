Agora sim a resposta foi boa. Ele trouxe evidência, testes, confiança e problemas reais. Eu **não aprovaria a Sprint 1 ainda**. Mandaria fazer um **hotfix curto**, sem abrir Sprint 2.

Use este prompt:

**Hotfix obrigatório — Fechamento da Sprint 1**

A auditoria independente da Sprint 1 foi aceita.

A Sprint 1 ainda NÃO está aprovada porque a taxa de confiança ficou em 76%.

Agora implemente apenas os hotfixes necessários para elevar a confiança para 95%+.

Não avance para Sprint 2.

Não implemente funcionalidades novas.

**Hotfix 1 — Remover dados demo do financeiro**

Problema:  
O financeiro está contaminado por appointments seedados: Cliente A, Cliente B e Cliente C.

Objetivo:  
Remover dados fictícios do ambiente e impedir que eles voltem a ser criados.

Ações:

1. Criar migration segura para remover os appointments demo.
2. Verificar se existem payments relacionados a esses appointments.
3. Remover ou corrigir qualquer seed/migration que possa recriar esses dados.
4. Garantir que /financeiro não exiba valores fictícios.

Não apagar dados reais.

Antes de deletar, filtre apenas registros claramente demo/teste.

&nbsp;

**Hotfix 2 — Remover ?debug=false da URL da Agenda**

Problema:  
A rota /agenda está reescrevendo a URL para /agenda?debug=false.

Objetivo:  
A URL padrão deve ser limpa:

/agenda

O parâmetro debug só deve aparecer quando for true:

/agenda?debug=true

Ações:

1. Corrigir validateSearch/default search em src/routes/_authenticated/agenda.tsx.
2. Garantir que navegar para /agenda não adicione debug=false.
3. Garantir que debug=true continue funcionando se necessário.

&nbsp;

**Hotfix 3 — Corrigir i18n para PT como padrão real**

Problema:  
Com navegador PT-BR, várias labels aparecem em inglês.

Objetivo:  
O idioma padrão deve ser PT.

Ações:

1. Configurar fallbackLng como pt.
2. Garantir supportedLngs: pt, en, fr.
3. Garantir que pt-BR resolva para pt.
4. Revisar chaves usadas em:
  - Agenda
  - Novo agendamento
  - Serviços
  - Checkout
  - Navegação
  - Financeiro
5. Adicionar chaves faltantes em pt.json.
6. Garantir que não haja textos hardcoded em inglês nos principais fluxos.

&nbsp;

**Hotfix 4 — Console error Supabase**

Problema:  
Aparece TypeError: Failed to fetch vindo de supabase-js durante navegação/teardown.

Objetivo:  
Investigar se é apenas ruído ou erro real.

Ações:

1. Identificar a origem exata.
2. Se for ruído de teardown/refresh, tratar de forma segura.
3. Se for erro real de sessão/auth, corrigir.
4. Não esconder erros importantes de produção.

&nbsp;

**Validação obrigatória com Playwright**

Após aplicar os hotfixes, execute novamente a bateria completa:

- login admin
- login artist
- /agenda
- /appointments/new
- /appointments/new/services
- /appointments/new/checkout
- /ghl-test admin
- /ghl-test artist
- /financeiro admin
- /financeiro artist
- desktop
- mobile

Validar:

- sem hydration mismatch
- sem dados demo no financeiro
- /agenda sem ?debug=false
- PT-BR renderizando em PT
- admin acessa /ghl-test
- artist não acessa /ghl-test
- rotas filhas renderizam corretamente
- sem erros críticos no console
- sem network errors inesperados

**Entrega final obrigatória**

Ao final entregue:

1. Arquivos alterados
2. Migrations criadas/alteradas
3. Dados removidos
4. Evidência dos testes Playwright
5. Console/network final
6. Taxa de confiança atual
7. Sprint 1 aprovada? Sim/Não
8. Bugs restantes, se houver

Não avance para Sprint 2 até a Sprint 1 atingir no mínimo 95% de confiança.

Esse é o caminho certo: **fecha o chão antes de construir o segundo andar**.