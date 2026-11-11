# Agenda no celular — análise UI/UX Pro Max (preto e dourado)

Nada será alterado até sua aprovação. Dados, integração com o GHL, regras de acesso e cálculos ficam intactos: as mudanças são só visuais.

## Problemas encontrados, por prioridade

### 1. Legibilidade (crítico)
- Muitos textos com 9–10px (horários, nomes dos tatuadores, serviços, etiquetas, visões de semana e mês). A skill pede no mínimo 12px no celular e 16px no texto principal.
- O cinza secundário sobre o fundo quase preto fica no limite do contraste nas letras pequenas.
- **Sugestão:** subir a escala para 12px (detalhes), 13–14px (nome do cliente e do serviço) e 16px (data em destaque); números em fonte tabular.

### 2. Toque e botões (crítico)
- Botões de 32px de altura (setas, Hoje, visões) e chips pequenos de tatuador ficam abaixo dos 44px recomendados para o dedo.
- O espaço vago "+ Novo agendamento" é invisível até receber o toque (efeito pensado para mouse, sem utilidade no celular).
- **Sugestão:** áreas de toque de 44px, espaço de 8px entre controles e um "+" dourado discreto e sempre visível nos horários livres.

### 3. Hierarquia e organização (alto)
- Ainda há 3–4 faixas empilhadas antes dos horários (status do CRM, controles, resumo e tatuadores).
- O aviso "Desatualizado" ocupa uma faixa inteira e não oferece nenhuma ação.
- **Sugestão:** um cabeçalho fixo e compacto com a data, ‹ Hoje › e a visão; um ponto de status (dourado ou vermelho) que abre os detalhes ao toque; resumo do dia na mesma linha da data; trilho de tatuadores com rolagem horizontal logo abaixo.

### 4. Identidade preta e dourada (alto)
- Os tokens já são preto quente e dourado, mas o dourado quase não aparece. Os cartões usam cinza neutro, e as cores aleatórias por artista (avatares com texto branco) brigam com a marca.
- O aviso usa o mesmo dourado da cor principal, então um alerta parece um destaque.
- **Sugestão:** dourado só para a ação principal, o dia de hoje, a linha da hora atual e o tatuador selecionado. Cartões em preto elevado com filete dourado à esquerda conforme o status: confirmado em dourado, pendente com contorno, compareceu em verde suave, cancelado esmaecido. Aviso em âmbar próprio, diferente do dourado. Avatares em tons neutros com anel dourado quando selecionados.

### 5. Tipografia (médio)
- Tudo em uma única família de fonte, sem um momento editorial.
- **Sugestão:** fonte serifada elegante só na data em destaque e nos títulos, e a sem serifa atual no restante (escolha a seguir).

### 6. Navegação (médio)
- O menu inferior não reserva a área segura do iPhone, e o "+" central não tem destaque dourado.
- "Mês anterior" escondido dentro do calendário é difícil de achar.
- **Sugestão:** área segura no rodapé, "+" dourado em destaque e um gesto de deslizar para trocar de dia (as setas continuam).

### 7. Detalhes (baixo)
- Plural "1 reservas".
- Etiquetas de status ainda em inglês (showed, booked).
- Puxar a tela para baixo atualiza a página sem querer.
- **Sugestão:** corrigir o plural, traduzir os status e bloquear essa atualização acidental dentro da grade.

## Entrega em fases (cada uma revisável)
1. Legibilidade, toque e textos (itens 1, 2 e 7).
2. Cabeçalho compacto e status do CRM (item 3).
3. Cores, cartões e tipografia da marca (itens 4 e 5).
4. Menu inferior e gesto de troca de dia (item 6).

Verificação: capturas no celular (393×852) e no computador, sem corte horizontal, conferindo os modos administrador e artista.

## Detalhes técnicos
- Arquivos: `src/routes/_authenticated/agenda.tsx`, `src/components/layout/bottom-nav.tsx`, `src/styles.css` (novos tokens `--warning` âmbar, `--gold-line`, status) e `pt.json` e `en.json` (plural com `_one`/`_other`, status traduzidos).
- Mantidos sem alteração: consultas, `restrictArtistId`, escopo de identidade, filtros de inativos e de Augusto, chamadas ao CRM e testes atuais (rodar `npm test` ao final).
