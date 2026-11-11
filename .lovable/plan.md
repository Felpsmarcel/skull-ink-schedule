# Análise de todas as páginas (celular 393px e computador 1280px) — referência: Agenda

Medido em 20 páginas, logado como administrador. Nenhuma página corta para os lados. Nada foi alterado.

## Problemas que valem para todo o app (fazer primeiro)
1. **Menu em inglês e maiúsculas** — "Finance", "Profile", "NEW" no celular e no computador. Proposta: "Hoje, Agenda, +, Financeiro, Perfil", em caixa normal, como a Agenda.
2. **Títulos em MAIÚSCULAS e fonte "de máquina"** — EQUIPE, SERVIÇOS, VENDEDORES, FILA DO DIA, RELATÓRIO MENSAL, LINKS DE PAGAMENTO. Proposta: um único cabeçalho padrão (título com a fonte editorial da Agenda, subtítulo curto, voltar à esquerda, ação principal à direita).
3. **Letras pequenas demais (menos de 12px)** — Financeiro, Reconciliar, Relatório mensal, Equipe, Vendedores, Saúde, Links. Proposta: mínimo 12px, 16px no texto principal.
4. **Botões pequenos para o dedo** — muitos abaixo de 44px (Reconciliar, Relatório mensal, Serviços, Equipe). Proposta: altura mínima igual à Agenda.

## Por página, em ordem de prioridade
1. **Financeiro (crítico)** — os filtros ocupam a tela inteira antes de qualquer número; os totais aparecem cortados ("45 040,"); o título vira "Financ…"; a lista mostra Augusto, Miguel e as contas "GF TATTOO" como se fossem tatuadores; os cartões dizem **Comissão 40% / Estúdio 60%**, mas a regra combinada é 35% / 65%. Proposta: totais primeiro, filtros recolhidos em um botão "Filtros (3)", só tatuadores ativos, números que cabem. **A diferença 40/60 precisa da sua confirmação antes de qualquer mudança.**
2. **Novo agendamento (alta)** — tudo em inglês ("New appointment", "Search", "Pick a client"); as etapas aparecem cortadas ("CLI…", "PR…"). Proposta: português, barra de etapas "Passo 1 de 5 · Cliente" com linha de progresso.
3. **Reconciliar GHL (alta)** — lista longa de avisos técnicos repetidos (códigos 429/503), sem agrupar. Proposta: agrupar por tipo e calendário com contagem, um botão "Marcar todos como resolvidos" por grupo, detalhes técnicos escondidos.
4. **Relatório mensal (alta)** — tabela densa, letras pequenas e muitas maiúsculas. Proposta: resumo do mês no topo, tabela com colunas fixas no computador e cartões no celular.
5. **Hoje (média)** — boa base; mas rótulos em maiúsculas ("ABRIR", "AGUARDANDO") e "Gestão" escondido no fim. Proposta: caixa normal, "Gestão" virando atalhos visíveis para o administrador.
6. **Equipe e Vendedores (média)** — maiúsculas, letras pequenas, botões de editar minúsculos. Proposta: cartão por pessoa com foto, situação (ativo / férias) e botão "Editar" grande.
7. **Serviços (média)** — 51 botões pequenos na lista. Proposta: linhas tocáveis inteiras, preço alinhado à direita.
8. **Saúde do sistema e Links de pagamento (média)** — mesmos vícios de maiúsculas e letras pequenas; status sem cor de significado. Proposta: verde/âmbar/vermelho com texto, como o ponto do CRM da Agenda.
9. **Relatório de pagamentos, Fila do dia, Configurações, Menu, Avaliações, Projetos (baixa)** — já próximos da Agenda; só alinhar cabeçalho e rótulos.
10. **Registro de pagamento e Check-in do totem (baixa)** — títulos em maiúsculas ("BEM-VINDO"); no totem manter letras grandes, só ajustar o estilo.
11. **Agenda (referência)** — ainda mostra "Today" e "booked"; traduzir.

## Entrega sugerida (cada etapa com sua aprovação)
1. Menu, cabeçalho padrão, tamanhos mínimos e textos em português para todo o app.
2. Financeiro (depois da sua resposta sobre 40/60) e Novo agendamento.
3. Reconciliar e Relatório mensal.
4. Demais páginas.

Sem alterar dados, valores, GHL ou acessos; conferir cada etapa em 393px e 1280px.

## Recursos da skill usados
- Usados: busca de boas práticas de UX (navegação, toque, legibilidade) e as regras de prioridade da skill (acessibilidade, toque, layout, tipografia).
- Testado mas não adotado: o "sistema de design" automático sugeriu um estilo de página de apresentação animada em preto e branco — não combina com uma ferramenta de trabalho preta e dourada; mantive a identidade da Agenda.
- Não usados: paletas e fontes novas (a marca já está definida), animações e gráficos.
