## Objetivo
Todos os e-mails (auth e app) devem chegar como **GF Tattoo Studio &lt;noreply@notify.gftattooacademy.info&gt;** e mostrar "GF Tattoo Studio" no corpo. Hoje estão saindo com nomes técnicos herdados do scaffold (`skull-ink-schedule`, `app-gftattoo-schedule`), o que aparece no seu cliente de e-mail como "Ink" no lugar de "GF".

## Alterações

1. **`src/routes/lovable/email/auth/webhook.ts`**
   - `SITE_NAME = "GF Tattoo Studio"` (era `"skull-ink-schedule"`).
   - Isso ajusta tanto o header `From` quanto a variável `siteName` passada para os templates de auth (confirmação de cadastro, recuperação de senha, magic link, etc.).

2. **`src/routes/lovable/email/auth/preview.ts`**
   - `SITE_NAME = "GF Tattoo Studio"` para o preview no painel refletir o mesmo nome.

3. **`src/routes/lovable/email/transactional/send.ts`**
   - `SITE_NAME = "GF Tattoo Studio"` (era `"app-gftattoo-schedule"`).
   - Ajusta o header `From` dos e-mails do app (confirmação de agendamento, notificação de artista, lembrete 24h, boas-vindas de equipe).

Sem alterações em templates, banco, cron, DNS ou infraestrutura de e-mail. Domínio (`notify.gftattooacademy.info`) permanece igual.

## Verificação
Após aplicar, próximos e-mails enviados chegam com remetente "GF Tattoo Studio". E-mails já entregues não são reescritos. Se quiser confirmar sem esperar um evento real, dá para usar o preview no painel Cloud → Emails.
