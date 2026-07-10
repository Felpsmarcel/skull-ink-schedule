Objetivo: garantir que tatuadores convidados usem o app sem jamais tocar no código-fonte, vejam a agenda geral de todos os artistas, mas acessem apenas o próprio financeiro e nunca as configurações administrativas.

````text
Papéis atuais no banco
----------------------
- app_users com role="artist" + artist_id vinculado: acesso de tatuador.
- app_users com role="admin": acesso total.
- app_users com role="seller": acesso de vendedor (fora do escopo deste ajuste).

Convites enviados
-----------------
O fluxo `inviteArtist` já cria o usuário com role="artist" e vincula ao artist_id correto. Não concede role admin. Verificarei na base se todos os convites aceitos estão com role="artist".

Código-fonte
------------
Tatuadores acessam apenas a URL publicada do app. Não têm acesso ao repositório, ao editor Lovable nem a variáveis de ambiente/segredos. Nenhuma mudança de código é necessária para isso.

Ajustes de permissão no app
---------------------------
1. Agenda geral para tatuadores
   - Hoje a página `/agenda` filtra para que um artista veja apenas sua própria coluna (`restrictArtistId`).
   - Remover esse filtro para artistas, mantendo-o opcional para outros usos futuros.
   - Adicionar policy RLS em `appointments` permitindo artistas autenticados ler todos os agendamentos.
   - Adicionar policy RLS em `artists` permitindo artistas autenticados listar todos os artistas ativos (necessário para renderizar as colunas da agenda).
   - Manter as policies existentes que permitem artistas editar apenas seus próprios agendamentos.

2. Financeiro isolado
   - Hoje `getFinanceSummary` e as policies de `payments` já restringem o artista aos próprios agendamentos/comissões.
   - Nenhuma alteração necessária.

3. Área administrativa bloqueada
   - O layout `/_authenticated/_admin` já redireciona não-admins para `/agenda`.
   - Nenhuma alteração necessária.

4. Catálogo de serviços
   - A rota `/services` já é leitura para artistas e edição só para admin.
   - Nenhuma alteração necessária.

Validação
---------
- Simular login como um dos artistas convidados.
- Confirmar que `/agenda` mostra colunas de todos os tatuadores.
- Confirmar que `/financeiro` mostra apenas comissões do próprio artista.
- Confirmar que `/menu` não exibe links de admin e que tentar acessar `/admin/equipe` redireciona para `/agenda`.

Arquivos esperados para alteração
---------------------------------
- `src/routes/_authenticated/agenda.tsx` — remover restrição de artista na agenda.
- Migration SQL — adicionar policies RLS para leitura geral por artistas em `appointments` e `artists`.

Não serão alterados
-------------------
- `src/lib/team.functions.ts` (convites já estão corretos).
- `src/routes/_authenticated/_admin/route.tsx` (gate já existe).
- `src/routes/_authenticated/financeiro.tsx` e `src/lib/finance.functions.ts` (já isolam por artista).
- `src/routes/_authenticated/menu.tsx` (já oculta links de admin).
