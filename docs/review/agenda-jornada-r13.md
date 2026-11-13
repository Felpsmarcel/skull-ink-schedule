# Agenda GF Tattoo — adaptação Jornada (13/11/2026)

A agenda semanal passa a ter sete colunas no computador e um seletor de dia no celular. Os cartões exibem horário, cliente, descrição, tatuador e status do GHL e abrem a ficha já existente. A grade diária, o mês, os links de projetos e o fluxo de novo agendamento foram preservados. O período usa dias civis de Europe/Brussels, incluindo mudanças de horário.

## Valores e integridade

- A administração pode ler as anotações locais de valor e sinal por sessão. O vínculo exige EventID, tatuador, calendário e instante iguais; nomes não criam vínculos.
- O novo leitor é autenticado, exclusivo de administrador, paginado com contagem estável e sem gravação. O cache inclui identidade e função. Tatuadores não recebem esse resumo administrativo.
- Sinal informado não significa recebimento comprovado; os totais não representam oportunidades Won, contratos, comissão ou caixa.
- Randevu, cancelamentos e faltas ficam fora das somas. Importações com padrão 0/0 não comprovam sessão gratuita. Dados ausentes, contraditórios ou resposta inválida mantêm os totais a conferir.
- Uma sessão longa conta uma vez. Eventos distintos do mesmo cliente continuam distintos. Duplicatas contraditórias invalidam a soma.
- O acesso compartilhado de Randevu para todos os tatuadores continua dependendo da validação do escopo no servidor; esta alteração não amplia permissões.

## Validação

- 176 testes focados de agenda/agendamentos passaram, incluindo paginação, identidade, falha de resposta, datas, centavos, duplicatas e exclusões.
- TypeScript, ESLint focado, verificação de diff e build de produção executados.
- Fixture `tests/visual/agenda-jornada.html`: componentes reais com dados fictícios, sem CRM. Testados estados completo/parcial/vazio/carregando/valores desconhecidos, ocultação de valores no modo tatuador e abertura/fechamento por teclado do diálogo demonstrativo.
- Capturas 1440, 1280, 390 e 360 px; sem transbordamento horizontal. Revisão visual independente: dois ajustes encerrados (dias abreviados em 360 e montantes alinhados em 1280); disposição SHIP no escopo da fixture. Detector manual sem achados.
- A fixture não comprova ficha autenticada, dados reais, permissões reais de tatuador ou publicação pública. A conferência da prévia após integração é registrada separadamente no diretório de outputs.

## Escopo da entrega

Adaptação ao TanStack/Supabase/GHL existente. Não incorpora Prisma/NextAuth, contas fictícias, fuso Lisboa, financeiro em Float ou confirmação WhatsApp simulada do documento de referência. Não inclui migração, alteração de Edge Functions, mensagens, gravações de dados de clientes ou publicação do site.
