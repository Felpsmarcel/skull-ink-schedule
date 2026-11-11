# Painel do tatuador — André, somente prévia

## Entrega autorizada
- Separar no detalhe administrativo do projeto o valor comercial, sinal informado, saldo indicativo e caixa. Sem lançar recebimentos ou mudar cálculos existentes.
- Criar `/painel-tatuador` com hoje, próximos 30/60/90 dias, projetos ativos, datas vinculadas, conclusões registradas e continuidade a verificar. Administrador abre André por ID verificado e pode escolher outros artistas ativos.
- Reutilizar Agenda e detalhe de Projetos para navegação; preservar Home e Meu Dia, acrescentando apenas o acesso administrativo ao painel.

## Limitação verificada
As políticas `appt_artist_select_all` e `tattoo_projects_select_staff` permitem leitura ampla. Como alterar políticas não está autorizado, o novo painel será **admin-only**, com recusa no servidor para artista/seller/desconhecido. Liberação real aos artistas depende de autorização para segurança e homologação entre duas identidades. Sem comissão nova ou dados financeiros no painel.

## Técnica e arquivos
- Módulo puro de datas, continuidade e saldo indicativo; função GET autenticada e paginada por artist_id, fontes independentes.
- Nova rota e testes sintéticos; alteração localizada do detalhe de Projeto e link na Home; documentação em AGENTS.md e roadmap.
- Sinal vem de deposit_eur: informado, não caixa nem prova automática de pagamento vinculado. Com movimentos existentes ou fonte incompleta, saldo comercial fica A conciliar. Não correlacionar pagamento da consulta por nome/contato.
- Tipo new_tattoo pode ser padrão não confirmado; não apresentá-lo como classificação comprovada. Nenhuma inferência Won ou consulta/sessão.

## Aceite
Prévia autenticada em 393px/1280px, Hubaux com três datas (consulta excluída), 2.700/450/2.250 comercial versus 0/2.700 caixa; testes de autorização, DST, múltiplos projetos, falhas parciais e não dupla dedução. Testes e lint direcionados; compilação automática. Sem dados, GHL, booking, políticas ou publicação alterados.

## Próximo passo
Implementar este incremento autorizado; liberação privada aos artistas permanece bloqueada pelas políticas amplas atuais.