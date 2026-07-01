## Ativar sync automático GHL (cron 10 min)

Hoje o `ghl_sync_status` mostra `job: null` e `vault_ok: false` — o cron nunca foi armado porque falta o segredo no Vault. As funções `schedule_ghl_sync()` / `unschedule_ghl_sync()` já existem e chamam `POST /api/public/hooks/sync-ghl` a cada 10 min usando `apikey` do Vault.

### Passos

1. **Popular o Vault** com o segredo `ghl_sync_anon_key` (valor = anon key pública do projeto, mesma que o cron precisa mandar no header `apikey`):
   ```sql
   select vault.create_secret(
     '<anon key>', 'ghl_sync_anon_key', 'Anon key usada pelo cron ghl-sync-10min'
   );
   ```
   Se já existir com placeholder `__set_me__`, faço `update` no lugar.

2. **Armar o cron** chamando `select public.schedule_ghl_sync();` — isso registra o job `ghl-sync-10min` com schedule `*/10 * * * *` apontando para `https://project--03a6f57d-9b2a-4876-a3b5-a886d4f4b51d.lovable.app/api/public/hooks/sync-ghl`.

3. **Validar**:
   - `select public.ghl_sync_status();` → `job.active = true`, `vault_ok = true`.
   - Aguardar 1 execução e conferir `runs[0].status = 'succeeded'`.
   - Conferir `select max(updated_at) from appointments;` avançou.

### Observações
- Segurança: o segredo fica só no Vault (nunca em código). O endpoint `/api/public/hooks/sync-ghl` já existe e valida internamente.
- Reversível a qualquer momento com `select public.unschedule_ghl_sync();`.
- Nenhuma alteração de código de app — só SQL/infra.
