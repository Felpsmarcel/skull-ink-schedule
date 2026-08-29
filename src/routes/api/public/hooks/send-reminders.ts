import { createFileRoute } from '@tanstack/react-router'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Brussels',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}


export const Route = createFileRoute('/api/public/hooks/send-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Simple guard: cron sends the anon key in apikey header. Reject anything
        // else to keep the endpoint from being trivially triggered externally.
        const apikey = request.headers.get('apikey') ?? ''
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
        if (!expected || apikey !== expected) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')


        const now = new Date()
        const from = new Date(now.getTime() + 23 * 3600_000).toISOString()
        const to = new Date(now.getTime() + 25 * 3600_000).toISOString()

        // Load upcoming appointments in the 23–25h window.
        const { data: appts, error } = await supabaseAdmin
          .from('appointments' as never)
          .select(
            'id, contact_email, contact_name, start_at, artist_id, services, artists:artist_id(name)',
          )
          .gte('start_at', from)
          .lt('start_at', to)
          .in('status', ['pending', 'confirmed'] as never)

        if (error) {
          console.error('[send-reminders] query failed', error)
          return Response.json({ error: error.message }, { status: 500 })
        }

        type Row = {
          id: string
          contact_email: string | null
          contact_name: string | null
          start_at: string
          services: Array<{ name?: string }> | null
          artists: { name?: string } | null
        }
        const rows = (appts ?? []) as Row[]

        let sent = 0
        let skipped = 0

        for (const a of rows) {
          if (!a.contact_email) {
            skipped++
            continue
          }
          const messageId = `appt-reminder-${a.id}`

          // Skip if we already logged a send/queued for this reminder.
          const { data: existing } = await supabaseAdmin
            .from('email_send_log' as never)
            .select('id')
            .eq('message_id', messageId)
            .limit(1)
            .maybeSingle()
          if (existing) {
            skipped++
            continue
          }

          const email = a.contact_email.toLowerCase()

          // Suppression check.
          const { data: suppressed } = await supabaseAdmin
            .from('suppressed_emails' as never)
            .select('id')
            .eq('email', email)
            .maybeSingle()
          if (suppressed) {
            await supabaseAdmin.from('email_send_log' as never).insert({
              message_id: messageId,
              template_name: 'appointment-reminder',
              recipient_email: a.contact_email,
              status: 'suppressed',
            } as never)
            skipped++
            continue
          }

          // Ensure unsubscribe token.
          const { data: tok } = await supabaseAdmin
            .from('email_unsubscribe_tokens' as never)
            .select('token, used_at')
            .eq('email', email)
            .maybeSingle()
          let unsubToken: string
          if (tok && !(tok as { used_at: string | null }).used_at) {
            unsubToken = (tok as { token: string }).token
          } else {
            unsubToken = generateToken()
            await supabaseAdmin
              .from('email_unsubscribe_tokens' as never)
              .upsert({ token: unsubToken, email } as never, {
                onConflict: 'email',
                ignoreDuplicates: true,
              })
            const { data: stored } = await supabaseAdmin
              .from('email_unsubscribe_tokens' as never)
              .select('token')
              .eq('email', email)
              .maybeSingle()
            if (stored) unsubToken = (stored as { token: string }).token
          }

          const servicesSummary = (a.services ?? [])
            .map((s) => s?.name)
            .filter(Boolean)
            .join(', ')
          const props = {
            clientName: a.contact_name ?? undefined,
            artistName: a.artists?.name ?? undefined,
            whenLabel: whenLabel(a.start_at),
            servicesSummary,
          }
          const element = React.createElement(template.component, props)
          const html = await render(element)
          const text = await render(element, { plainText: true })
          const subject =
            typeof template.subject === 'function' ? template.subject(props) : template.subject

          await supabaseAdmin.from('email_send_log' as never).insert({
            message_id: messageId,
            template_name: 'appointment-reminder',
            recipient_email: a.contact_email,
            status: 'pending',
          } as never)

          const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email' as never, {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: a.contact_email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: 'transactional',
              label: 'appointment-reminder',
              idempotency_key: messageId,
              unsubscribe_token: unsubToken,
              queued_at: new Date().toISOString(),
            },
          } as never)

          if (enqErr) {
            await supabaseAdmin.from('email_send_log' as never).insert({
              message_id: messageId,
              template_name: 'appointment-reminder',
              recipient_email: a.contact_email,
              status: 'failed',
              error_message: enqErr.message,
            } as never)
            continue
          }
          sent++
        }

        return Response.json({ ok: true, considered: rows.length, sent, skipped })
      },
    },
  },
})