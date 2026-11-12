# Financeiro por fonte — R12

A tela anterior somava valores integrais de agendamentos na categoria "Pago" ao encontrar qualquer pagamento; os filtros alteravam somente a lista. A rota `/financeiro` agora usa uma projeção de leitura independente com quatro áreas, filtros de data/tatuador acima dos indicadores e os mesmos registros para cartões e listagem.

## Áreas e significado

- Vendas e projetos: carteira de orçamentos locais, filtrada por data de cadastro. Um projeto é contado por seu ID. Não apresenta orçamento como venda Won. A data de ganho no GHL continua a apurar: a fonte existente filtrava criação da oportunidade.
- Recebimentos: lançamentos não excluídos de `movimentacoes`, por `data_pagamento`, com estornos subtraídos uma vez. O total precisa corresponder à soma dos meios de pagamento. Não soma novamente `payments`, sinais anotados ou valores de sessão. "Registrado" não significa comprovação bancária.
- Sessões e comissões: base cadastrada e estimativas. Tatuador usa percentual do agendamento; vendedor usa o percentual atual de seu cadastro. Randevu por calendar ID, cancelamentos e faltas ficam fora dos agregados. A regra de André por realização e comissões já pagas não são recalculadas ou persistidas.
- Repasses: apurado, aprovado e pago permanecem desconhecidos. Não há uma fonte validada de pagamentos à equipe nesta implementação.

## Limites e proteção

Reader autenticado GET e role validado antes de acesso. Não usa cliente privilegiado nem chamadas ao CRM. Artista/vendedor exigem vínculo ativo e RPC filtrado pelo ID resolvido no servidor; respostas são projetadas por campos permitidos, sem bruto ou valores de outros beneficiários. A chave de cache inclui usuário, papel e vínculos. Isso não substitui homologação real de login/RLS do tatuador.

Paginação ordenada por ID, com contagem exata estável e rejeição de duplicatas ou datas inválidas. Falha de uma fonte afeta somente sua área. Valores inválidos permanecem null, nunca zero fabricado ou soma parcial. Datas customizadas usam limites inclusivos civis Europe/Brussels e fim UTC exclusivo. Entrada nativa de data reage a input/change. Listas têm revelação progressiva de 30 linhas, sem limitar os totais calculados da leitura completa.

Nenhuma migração, lançamento, pagamento, oportunidade, permissão ou estado de repasse é alterado. Nenhuma publicação pública faz parte desta entrega.

## Verificação

- Testes focados de núcleo/servidor: datas reais e DST, filtros consistentes, IDs distintos/duplicados, paginação contraditória, fontes indisponíveis, sinal parcial, estorno, valores inválidos, cancelamentos/Randevu, escopo e projeção de artista/vendedor.
- Tipos TypeScript, ESLint focado e build de produção.
- Fixture isolado `/finance-workspace.html` usa apenas dados fictícios e rotas locais. Validação visual desktop 1440 e mobile 390/360 sem overflow horizontal; filtros, teclado no disclosure, estados carregando/vazio/erro/parcial, ausência de bruto no perfil do tatuador e intervalo inválido foram conferidos. Dezembro selecionado por datas mostra somente a sessão daquele mês.
- A validação de publicação/prévia integrada é registrada separadamente nos outputs da execução.
