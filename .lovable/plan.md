## Objetivo

Dar ao Gabriel Fernandes acesso total de admin — ver e editar agendamentos de todos os tatuadores, mais financeiro, equipe, vendedores, reconciliar GHL e relatórios.

## O que muda

Existem 2 usuários (logins) vinculados ao artista "Gabriel Fernandes" no `app_users`:

- `2e8a0cee-67c5-48fe-8d49-efd306e74f60`
- `2feb1be9-09b5-4916-93b5-61b0b8a510f6`

Ambos hoje estão como `role = 'artist'`. Vou promover os dois para `role = 'admin'` via migration SQL:

```sql
UPDATE public.app_users
SET role = 'admin'
WHERE id IN (
  '2e8a0cee-67c5-48fe-8d49-efd306e74f60',
  '2feb1be9-09b5-4916-93b5-61b0b8a510f6'
);
```

Mantenho o `artist_id` apontando para o artista dele, para que agendamentos criados/atribuídos a ele continuem sendo reconhecidos como "do Gabriel" no financeiro/comissões.

## Efeito prático

Assim que a migration rodar, no próximo carregamento do app o Gabriel passa a:

- Ver a agenda de todos os tatuadores (não só a própria).
- Editar/mover/cancelar qualquer agendamento.
- Acessar Financeiro global, Equipe, Vendedores, Reconciliar GHL e Relatório mensal no menu.
- Continuar aparecendo como artista em agendamentos onde ele é o tatuador.

## Fora de escopo

- Não crio um novo papel intermediário ("gerente"/"supervisor"); pedido foi acesso de admin.
- Não mexo em RLS nem em `has_role`/`current_user_role` — a mudança de papel no `app_users` já é suficiente porque as policies e funções existentes olham para esse campo.
- Não removo o vínculo com o artista `Gabriel Fernandes` (para não quebrar histórico de comissões).

## Arquivos

- Nova migration em `supabase/migrations/…_promote_gabriel_admin.sql` com o `UPDATE` acima.
