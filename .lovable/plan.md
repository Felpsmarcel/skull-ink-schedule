## Objetivo

Habilitar app emails no projeto (a infra de auth emails já existe, mas nunca configuramos os transacionais) e disparar 4 tipos:

1. **Confirmação para o cliente** — no checkout do agendamento
2. **Notificação para o artista** — no checkout do agendamento
3. **Boas-vindas para equipe** — quando um artista aceita o convite
4. **Lembrete 24h antes** — via cron

## Passos

### 1. Infra de app emails
Rodar `scaffold_transactional_email`. Isso cria:
- `/lovable/email/transactional/send` (autenticado)
- `/lovable/email/transactional/preview`
- `/email/unsubscribe` (validação) + página branded
- `src/lib/email-templates/registry.ts`
- Templates de exemplo

A infra base (`setup_email_infra`, filas, cron dispatcher, `email_send_log`, `suppressed_emails`) já está pronta.

### 2. Quatro templates novos em `src/lib/email-templates/`
Estilo B/W minimalista já usado nos auth emails (Archivo Black/Inter, fundo `#ffffff`, botão preto).

- `appointment-confirmation.tsx` — cliente: data/hora (Europe/Brussels), artista, serviço(s), total, endereço, botão "Ver agendamento".
- `artist-new-booking.tsx` — artista: cliente, telefone, data/hora, serviço, notas, valor da comissão dele.
- `team-welcome.tsx` — novo artista: boas-vindas + link para `/agenda`.
- `appointment-reminder.tsx` — lembrete 24h: data/hora, artista, endereço, política de cancelamento.

Registrar todos em `registry.ts`.

### 3. Helper de disparo
`src/lib/email/send.ts` — POST autenticado para `/lovable/email/transactional/send` com `templateName`, `recipientEmail`, `idempotencyKey`, `templateData`.

### 4. Gatilho no checkout
Estender `finalizeAppointment` (`src/lib/appointments.functions.ts`) para, após gravar em GHL+Supabase, enfileirar os dois emails:
- `appointment-confirmation` → `contact.email` (idempotency: `appt-confirm-{appointment.id}`)
- `artist-new-booking` → `artist.email` (idempotency: `appt-artist-{appointment.id}`)

Falha de email **não** aborta o agendamento — apenas loga em `email_send_log` como `failed`.

### 5. Gatilho no aceite do convite (equipe)
Após o novo artista completar o signup vindo do invite, disparar `team-welcome` uma vez (idempotency: `team-welcome-{user.id}`). Ponto de integração: `src/lib/team.functions.ts` (ou hook pós-auth).

### 6. Lembrete 24h (cron)
- Nova rota pública `src/routes/api/public/hooks/send-reminders.ts` protegida por `apikey` (anon key).
- Query: appointments com `start_at` entre agora+23h e agora+25h, `status in ('pending','confirmed')`, sem lembrete já enviado (`email_send_log.message_id = 'appt-reminder-{id}'`).
- Loop por resultado, dispara `appointment-reminder` com idempotency key.
- `pg_cron` a cada 30min chamando o endpoint com `apikey`, mesmo padrão do `ghl-sync-10min`.

### 7. Validação
- Preview local dos 4 templates em `/lovable/email/transactional/preview`.
- Um checkout real de ponta a ponta e conferência em `email_send_log` (status `sent`) + inbox.
- Simular cron do lembrete com `SELECT public.send_reminders_test()` ou curl direto ao endpoint.

## Detalhes técnicos

- Dominio de envio: `notify.gftattooacademy.info` (já configurado nos auth emails).
- TTL app emails: 60 min. Filas: `transactional_emails`.
- Verificar antes de enviar: `contact.email` não vazio + não em `suppressed_emails` (a rota `/send` já checa).
- Timezone Europe/Brussels em todos os templates via `Intl.DateTimeFormat(locale, { timeZone: 'Europe/Brussels' })`.
- i18n: idioma vem de `contact.language` ou fallback `pt`.
