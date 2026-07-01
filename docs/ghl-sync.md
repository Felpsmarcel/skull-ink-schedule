# GHL Sync — Runbook

O sync do GHL para o Supabase roda via `pg_cron` chamando o endpoint público
`POST /api/public/hooks/sync-ghl` a cada 10 minutos. O endpoint autentica
pelo header `apikey` (padrão Lovable + pg_cron).

## 1. Popular a anon key no Vault (uma vez)

Rode no SQL editor da Cloud (ou via psql), substituindo `<ANON_KEY>` pela
publishable/anon key do projeto:

```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'ghl_sync_anon_key'),
  '<ANON_KEY>'
);
```

A migration inicial cria a linha com valor `__set_me__` — trocar por uma
chave válida (comprimento >= 20 caracteres) é obrigatório antes de instalar
o cron.

## 2. Instalar o cron

Via UI: **Menu → Equipe → Sync GHL → Instalar cron** (admin only).

Via SQL:

```sql
SELECT public.schedule_ghl_sync();
```

A função:
- valida que o chamador é admin (`has_role`);
- garante que o Vault tem a chave;
- remove qualquer job `ghl-sync-10min` anterior;
- cria novo `cron.schedule('ghl-sync-10min', '*/10 * * * *', ...)`.

## 3. Verificar

Via UI: a mesma tela mostra `Agendado: */10 * * * · ativo` + últimas 5
execuções.

Via SQL:

```sql
SELECT public.ghl_sync_status();
```

## 4. Desligar

```sql
SELECT public.unschedule_ghl_sync();
```

## Por que apikey e não CRON_SECRET?

`/api/public/*` já bypassa o auth do edge Lovable. O padrão documentado
para pg_cron é enviar `apikey: <anon>`; o endpoint valida contra
`SUPABASE_PUBLISHABLE_KEY`. Adicionar um segredo extra dobraria pontos de
rotação sem ganho real de segurança para essa superfície.