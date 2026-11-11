# GF Tattoo — plano seguro da operação interna

## Escopo e evidência
Somente diagnóstico e planejamento. Nenhum código, configuração, skill, conhecimento, dado, banco, GHL ou publicação foi alterado nesta revisão; apenas este documento de plano foi registrado para aprovação. Não atualizei o roadmap, respeitando a proibição de alterações no projeto.

Inspeção do projeto atual: Totem, Home, Agenda, fila, assistente, projetos, finanças, funções de booking e identidade; leitura das definições e políticas reais do banco, sem consultar registros pessoais nem chamar o GHL. Não foi usado outro projeto. As observações visuais anteriores cobrem páginas iniciais em 393×852 e 1280×1800 como administrador, não todos os detalhes ou perfis. Nesta revisão os fluxos foram inspecionados no código; não executados. Não houve testes de escrita ou prova de isolamento com duas sessões reais.

**Direção:** operação clara e verificável, não uma troca cosmética. A Agenda é referência de legibilidade e toque, não imposição de preto/dourado. Identidade visual aberta; sem obrigação de glassmorphism.

## 1. Diagnóstico prioritário

### P0 — acesso precisa ser condição de liberação, não promessa
- `list_checkins_hoje`, no banco atual, é SECURITY DEFINER: aceita qualquer papel reconhecido e devolve os check-ins do dia sem filtrar por artista. A Home filtra antes de responder ao navegador; `getFilaHoje` não filtra. Portanto **a proteção visual não comprova isolamento da fila**.
- As políticas atuais incluem SELECT amplo para artistas em `appointments` e SELECT para qualquer papel reconhecido em `tattoo_projects`. As novas leituras de Projetos filtram no servidor, mas isso não fecha caminhos diretos ao banco ou funções antigas.
- `homeRole` transforma qualquer papel não admin/artista em recepção; o escopo passa a ser global. O enum real tem `admin`, `artist`, `seller`, não um papel próprio de recepção. Não ampliar recepção por interpretação.
- O proxy legado no repositório tem autorização condicional e libera operações sem calendário sem demonstrar escopo por contato. Existem preparações de revisão separadas; **a versão realmente implantada não foi confirmada**. Não usar o redesenho para ativar ou substituir o proxy.

Nada disso será corrigido silenciosamente. Um painel privado só será liberado após comprovar isolamento; qualquer correção de RLS/RPC/proxy exige autorização separada. A primeira entrega pode ficar restrita ao administrador, se aprovada, enquanto os demais acessos são homologados.

### P1 — Home ainda não responde ao dia inteiro
`getHomeDashboard` busca até 20 agendamentos cujo fim ainda não passou e destaca apenas o próximo. A fila vem de outra leitura, sem o cruzamento completo. Não responde quem estava previsto mais cedo, quem terminou ou quem ficou sem verificação. Falhas de algumas leituras podem virar lista vazia/zero: a proposta mostrará “Não disponível”, nunca “Ninguém chegou” quando a fonte falhou.

### P1 — chegada, sessão e venda são coisas diferentes
Chegada está em `checkins`; realização da sessão está em `appointments.status`; venda está na oportunidade GHL. `booked/confirmed` não significa chegada. `showed` não será interpretado como tatuagem concluída. Sem check-in = **chegada não verificada**, não ausência.

### P1 — continuidade pode escolher um projeto novo indevidamente
Na ficha, “Agendar sessões do projeto” preenche `decision: new` e pula a escolha de projeto. Já o detalhe de Projetos possui caminho de reutilização. Redesenhar o acesso deve privilegiar o vínculo existente e a escolha explícita, sem mudar a lógica de booking nem apagar a consulta.

### P2 — natureza, finanças e conclusão ainda exigem cautela
- O booking tem tipos `new_tattoo/cover_up/retouch`, mas não um campo explícito consulta versus sessão. Serviço/calendário/título podem dar pistas, não classificação comprovada. Uma consulta também pode ficar ligada a um projeto.
- Há 40% como fallback no booking e 35% fixo no cálculo de Projetos. Preservar valores e documentar a divergência; não “corrigir” percentuais na UI.
- Projetos calculam progresso por sessões `completed`; ausência de próxima data não prova conclusão. Não há quantidade planejada de sessões persistida identificada no contrato de projeto: não inventar “faltam 2”.

## 2. Mapa de rastreabilidade

| Marco | Estado atual / fonte de verdade | IDs de correlação | Leitura existente | Ação existente | Lacuna / risco |
|---|---|---|---|---|---|
| Cliente | Contato GHL e espelho `contacts` | `contacts.id`, `ghl_contact_id` | Totem; lookup de contexto; busca do assistente | Criar/atualizar contato no booking; Totem pode criar via integração | Nome não identifica; múltiplos contatos exigem revisão |
| Consulta | `appointments`/evento GHL, serviços e calendário; sem natureza explícita identificada | ID local, `ghl_appointment_id`, contato, calendário | Agenda/ficha | Booking e edições existentes | Não deduzir consulta de preço zero, nome ou calendário isolados |
| Check-in | `checkins`, chegada registrada | `id`, `appointment_id`, IDs GHL do contato/evento/oportunidade | `getFilaHoje`, RPC, Home | `confirmarChegada` grava `arrived_at` | Pode faltar vínculo local; múltiplos eventos do contato no dia são ambíguos |
| Atendimento | `checkins.status`, `started_at`, `finished_at` | Check-in e agendamento vinculado | Fila retorna início; Home não retorna início/fim; RPC não retorna fim | `setCheckinStatus`: iniciar/concluir | Concluir atendimento não atualiza automaticamente sessão/projeto/comercial |
| Orçamento | Existe `quotes` com valor/status; oportunidade tem referência comercial | `quotes.id`, contato, artista; oportunidade quando comprovada | Nenhuma leitura dedicada de `quotes` encontrada no código inspecionado | Nenhum fluxo dedicado encontrado | Não tratar pagamento, consulta ou oportunidade aberta como orçamento aprovado |
| Oportunidade | GHL: status, pipeline, referência integral | `ghl_opportunity_id`, contato, projeto local | Lookup busca abertas, até 20; sem prova de paginação completa | Booking cria `open` ou reutiliza, com confirmação e idempotência | Não cobre todas as ganhas; `won` na ficha é hipótese futura |
| Sessão | Evento GHL e espelho `appointments` | ID local/GHL, `project_id`, oportunidade, artista | Agenda, ficha, lista/detalhe de Projetos | Assistente, múltiplas sessões, edições/reconciliação | Criação sequencial pode terminar parcialmente; não prometer atomicidade |
| Pagamento | `payments` e `movimentacoes`, fontes distintas | IDs de lançamento, projeto, sessão, contato/oportunidade | Financeiro, ficha, relatórios, finanças do projeto | Registrar/editar e vincular nos fluxos existentes | Informado ≠ confirmado; fontes não podem ser somadas em duplicidade; 40/60 versus 35/65 |
| Próxima sessão | Menor data futura pending/confirmed vinculada ao projeto | `project_id` + IDs de sessões | `sessionProgress`, detalhe de Projetos | “Agendar próxima sessão” reutiliza assistente | Sem próxima data ≠ sessão obrigatoriamente pendente; apresentar “Sem próxima sessão marcada” |
| Projeto concluído | `tattoo_projects.status` separado do progresso | Projeto/oportunidade e sessões | Lista/detalhe filtram status; progresso conta completed | Não identificado comando dedicado de conclusão | Não concluir automaticamente pelo calendário, pagamento ou 100% das sessões conhecidas |

**Horários e falta, exatamente:** `confirmarChegada` grava a chegada; `setCheckinStatus` grava início em `em_atendimento` e fim em `concluido`. A fila tem ação manual “Não compareceu” sobre check-in já registrado, sem horário específico de falta ou justificativa nesse handler. Isso é semântica a revisar, não autorização para automatizar ausência. Datas operacionais em Europe/Brussels; helpers do Totem usam offset fixo `+02:00`, incompatível com o inverno — registrar dívida técnica, não alterar agora nem reutilizar esse helper no novo cruzamento.

**Filtro do artista:** Home consulta agenda com `artist_id` e filtra a fila antes da resposta; `listArtistProjects/getProjectDetail` verificam `app_users` no servidor e restringem ao artista, retornando bruto/saldo/recebido como null para artistas. `resolveDashboardScope` também exige vínculo CRM ativo. Esses controles específicos coexistem com os caminhos amplos acima: isolamento completo permanece não homologado.

## 3. Wireflows propostos

### Totem — preservar chegada existente
```text
Chegada → buscar cliente → confirmar identificação → confirmar chegada existente → código/QR
         sem vínculo seguro → manter fluxo assistido existente, sem vincular por suposição
```
Não executar essa confirmação durante homologação read-only: o handler atual também chama GHL para contato, tags, campos e workflow configurado. O acionamento depende da configuração; não foi verificado ao vivo.

### Meu Dia — primeira entrega de valor
```text
Dia em Bruxelas + atualização/fonte
  → lista cronológica de TODOS os previstos do dia, inclusive já passados
  → cada linha: horário previsto | chegada | início | conclusão | tatuador
  → filtros de leitura: previstos / aguardando / em atendimento / concluídos / não verificados
  → abrir ficha existente da Agenda
  → chegadas sem agendamento vinculado em seção separada
```
Uma única projeção de leitura, sem nova tabela. Cruzar primeiro `appointment_id`; quando ausente, usar `ghl_appointment_id` comprovado. Conflitos entre IDs vão para “Vínculo a conferir”, nunca correspondência automática por nome ou primeiro projeto do contato. Preservar registros históricos e mostrar separadamente cancelamento/falta explícita.

As categorias podem se sobrepor: não somar contagens como funil de conversão. Contagem só quando todas as páginas foram lidas; atraso ou erro da integração fica visível.

### Ficha única da Agenda
```text
Identificação e horário → natureza comprovada / “Natureza a conferir”
  → Agendamento GHL | Chegada/atendimento | Comercial (três linhas independentes)
  → projeto/oportunidade confirmados → sessões e próxima data → abrir projeto
  → financeiro permitido pela função → ações já existentes, sem novos envios
```
Consulta continua no histórico. Se houver vários projetos, escolher explicitamente antes de seguir ao assistente. Não criar botão funcional “Fechar venda” nesta fase.

### Dashboard privado do tatuador
```text
Meu Dia → agenda futura → projetos/coberturas ativos
        → sessões concluídas → projetos sem próxima sessão marcada
        → acompanhamento autorizado → parcela financeira já autorizada, quando verificável
```
Sem seletor de outro artista, bruto, 65%, comprovantes ou notas administrativas. Só chamar de cobertura quando `project_type=cover_up` for comprovado. Sem base elegível comprovada: “A apurar”, não promessa de comissão. Admin pode inspecionar artistas com o mesmo critério de leitura; recepção aguarda matriz de permissões aprovada.

## 4. Fases, arquivos e limites

### Fase A — Meu Dia, read-only, prioridade máxima
Reutilizar `/home`, `PageHeader`, estados de consulta e ficha da Agenda. Preparar projeção autenticada de leitura do dia com paginação completa e correlação por IDs. Não usar a RPC ampla para entregar fila ao artista.

Arquivos previstos: `src/routes/_authenticated/home.tsx`, `src/hooks/use-home-dashboard.ts`, `src/lib/home.functions.ts`, `src/lib/home-dashboard.ts`; eventualmente função pura pequena de correlação e componente de lista diária. Preservar respostas antigas usadas por outros consumidores ou introduzir versão de leitura isolada. Nada em booking/GHL/webhooks.

**Condição:** acesso por identidade verificada e papel conhecido. Admin primeiro é opção de liberação, não autorização já dada. Artista/recepção somente após testes de acesso e solução aprovada para os caminhos amplos.

### Fase B — ficha e Projetos, UI/read-only
Organizar os três eixos; destacar vínculo e continuidade sem alterar status ou valores. Reutilizar leituras de Projetos e fluxo explícito de reutilização. Antes de retomar booking pela ficha, homologar a escolha correta de projeto.

Arquivos: `agenda-appointment-sheet.tsx`, `projects.functions.ts`, `projetos.index.tsx`, `projetos.$projectId.tsx`; pequenas projeções de leitura, sem reescrever `finalizeBooking`.

### Fase C — dashboard e consistência visual
Compor o painel do artista com as leituras seguras já homologadas. Menu/desktop/mobile claros e coerentes, mantendo caminhos atuais. Financeiro recebe somente ajustes de organização e legibilidade, sem percentuais novos ou filtros que escondam histórico.

Arquivos: Home, menu e navegação existentes; `dashboard-scope.ts` e leituras autenticadas quando necessário; tokens visuais existentes após aprovação da direção. Não criar nova rota sem necessidade.

### Fase D — futuras escritas, fora desta autorização
Fechar `won`, classificação persistida consulta/sessão, conclusão comercial/projeto, confirmação adicional de presença, retornos automáticos, novos vínculos ou alterações de acesso. Cada item precisa de contrato, autorização, idempotência e homologação próprios. O redesenho não ativa automação nem promete que essas funções existam.

## 5. Aceite, segurança, testes e reversão
- 393px: primeiro bloco mostra o dia e a próxima informação operacional; texto principal 16px, auxiliar ≥12px, toque 44px, nomes longos sem corte, menu não encobre conteúdo; detalhe abre/fecha e volta ao filtro anterior.
- 1280px: lista comparável por horários, estados em colunas, sem esticar cartões de celular; teclado, foco e contraste mínimo 4,5:1. Cor nunca é o único indicador. Sem definir paleta antecipadamente.
- Casos sintéticos: dois artistas, admin, seller e usuário sem vínculo; IDs adulterados; dois eventos do mesmo contato; dois projetos homônimos; chegada sem sessão; sessão sem check-in; concluído sem pagamento; pagamentos parciais; projeto sem próxima data; paginação incompleta; inverno/verão e mudança de dia em Bruxelas.
- Assertivas concretas: confirmed não vira chegada; sem check-in não vira falta; consulta não é apagada; oportunidade conta uma vez por ID; respostas do artista não contêm bruto/outros artistas; fontes indisponíveis não produzem zero completo.
- Validar respostas e caminhos diretos de leitura, não só elementos ocultos. Executar testes pertinentes, lint e verificação da compilação disponível após implementação. Nada disso foi executado nesta revisão.
- Homologação sem confirmar Totem, agendar, pagar, resolver pendências ou chamar workflows reais. Cenários mutáveis apenas em ambiente isolado autorizado.
- Reversão: alterações pequenas nas telas e projeções, mantendo contratos anteriores; restaurar apresentação anterior sem migrar ou replicar dados. Não remover histórico, consultas, fotos, vínculos ou IDs. Publicação só com aprovação separada.

## 6. Aprovações e dependências
1. Aprovar Fase A e seu escopo inicial: admin primeiro ou incluir outros perfis somente após homologação de acesso.
2. Aprovar separadamente eventual correção de segurança em RPC/RLS/proxy; nenhuma mudança de papel neste plano.
3. Confirmar matriz de recepção: seller não equivale automaticamente a recepção com acesso global.
4. Definir fonte confiável para consulta versus sessão; enquanto não existir, mostrar natureza não confirmada.
5. Aprovar direção visual em uma amostra de Meu Dia; preto/dourado e efeitos não são obrigatórios.
6. Tratar divergência 40/60 e 35/65 em iniciativa financeira separada; preservar cálculos neste redesenho.
7. Qualquer escrita nova, mensagem, `won`, alteração GHL ou publicação exige aprovação específica posterior.

**Ponto exato para iniciar após aprovação:** construir primeiro o correlacionador puro agenda × check-ins com testes sintéticos; depois ligá-lo a uma leitura autenticada do dia em `home.functions.ts`, sem ampliar a Home atual para identidades desconhecidas, e renderizar a lista em `/home`. Se a aprovação não incluir segurança, limitar a liberação ao escopo comprovado — não afirmar dashboard privado pronto.

## Skill confirmada
Li a **Impeccable — edição Lovable instalada** e apliquei as disciplinas shape, critique, clarify, distill, adapt e harden ao planejamento. Ela é orientação de design; não contém CLI oficial, hooks, detector automático ou overlay. Nenhum desses recursos foi alegado ou instalado. Nesta etapa não há implementação nem certificação automática de acessibilidade.
