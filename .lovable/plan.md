# Tela "Projetos do Tatuador"

## Situação atual
- O banco já tem a tabela de projetos e cada sessão aponta para o seu projeto, mas hoje **não há nenhum projeto gravado** — a lista vai começar vazia até a primeira marcação com várias sessões.
- Já existe um cálculo de recebido/saldo por projeto; ele soma valores em decimal e trata ausência como zero. Será trocado por um cálculo em centavos que mostra "A apurar" quando faltar informação.

## O que o usuário verá
Nova página **Projetos** (atalho no menu e na ficha da sessão: "Ver projeto").

Lista (primeiro bloco):
- Filtros: tatuador (só administrador), situação (em andamento, concluídos, cancelados), busca por cliente. Filtros ficam no endereço e são preservados ao voltar.
- Cada cartão: cliente, título do projeto, tatuador, barra "2 de 3 sessões realizadas", próxima data, saldo.
- Fila separada "Sem tatuador" para o administrador resolver.

Detalhe do projeto:
- Cabeçalho: cliente, contato, tatuador, descrição.
- Linha do tempo: Sessão 1/3, 2/3, 3/3 com data e situação (agendada, realizada, faltou, cancelada); toque abre a sessão na Agenda.
- Termômetro financeiro (administrador): valor integral, sinal, recebido, saldo. Valores incompletos aparecem como "A apurar", nunca como zero.
- Tatuador vê somente os próprios projetos, datas e a sua parte de 35% sobre o recebido; não vê valor bruto, 65%, observações administrativas nem projetos de colegas.
- Ação "Agendar próxima sessão" reutilizando o assistente existente com o projeto já escolhido.

## Regras preservadas
- Projeto conta uma única vez pelo valor integral; sessões não multiplicam valor.
- Remarcar uma sessão não altera as outras.
- Augusto e Miguel inativos não aparecem nos filtros; histórico deles continua.
- Sem mudanças no banco, no CRM nem publicação.

## Detalhes técnicos
- `src/lib/project-progress-core.ts`: funções puras (centavos inteiros) para progresso, recebido, saldo, comissão 35% e estados incompletos.
- `src/lib/projects.functions.ts`: `listArtistProjects` e `getProjectDetail` com `requireSupabaseAuth`, escopo resolvido no servidor (admin = todos; artista = `current_artist_id()`; outros = negado), projeções explícitas e paginação; respostas do artista sem campos brutos.
- Rotas: `src/routes/_authenticated/projetos.index.tsx` e `projetos.$projectId.tsx` com `validateSearch`, loader + `useSuspenseQuery`, estados de carregamento/vazio/erro, `head()` próprio.
- Link no `bottom-nav`/menu e "Ver projeto" em `agenda-appointment-sheet.tsx`.
- Testes: `tests/unit/project-progress.test.ts` (3×900 € = 2.700 € uma vez; sinal abatido; estorno; remarcação não duplica; dado ausente = A apurar; 35% sobre recebido) e teste de escopo (artista não recebe projeto de outro artista nem campos brutos).
- Verificar no celular 393×852 e computador 1280×1800, sem corte horizontal.
