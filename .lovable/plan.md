## Diagnóstico

A Agenda renderiza o cabeçalho e a coluna de horários, mas **nenhuma coluna de artista aparece**. Isso porque `useArtists()` está recebendo **HTTP 403 permission denied** no `GET /rest/v1/artists`:

```
{"code":"42501","message":"permission denied for table artists",
 "hint":"Grant the required privileges to the current role with:
         GRANT SELECT ON public.artists TO authenticated;"}
```

O que aconteceu: no hardening de segurança recente (finding `artists_email_phone_public_read`) o `GRANT SELECT` para `authenticated` foi removido junto com o de `anon`. As policies RLS continuam certas (admin vê tudo; artista vê a própria linha), mas sem GRANT o PostgREST nem chega a avaliar RLS — bloqueia na camada de privilégio.

## Correção

Migração SQL única:

```sql
GRANT SELECT ON public.artists TO authenticated;
-- (anon continua SEM acesso — não regride o finding de segurança)
```

Isso restaura a leitura para usuários logados, mantendo a proteção contra leitura pública (anon) e mantendo a restrição por linha via RLS (`artists_admin_read` e `artists_self_read`).

## Validação

1. Recarregar `/agenda` — as 6 colunas de artistas voltam.
2. Confirmar via network que `GET /rest/v1/artists` retorna 200 com a lista completa (admin) ou apenas a própria linha (artista).
3. Rodar o security linter — o finding `artists_email_phone_public_read` deve continuar resolvido (anon segue sem grant).

Nenhum código de aplicação muda; é só a migração.
