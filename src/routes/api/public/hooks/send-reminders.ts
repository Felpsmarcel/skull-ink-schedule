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

          const servicesSummary = (a.services ?? [])
            .map((s) => s?.name)
            .filter(Boolean)
            .join(', ')

          const logRow = async (status: string, errorMessage?: string) => {
            const { error: logErr } = await supabaseAdmin.from('email_send_log' as never).insert({
              message_id: messageId,
              template_name: 'appointment-reminder',
              recipient_email: a.contact_email,
              status,
              ...(errorMessage ? { error_message: errorMessage } : {}),
            } as never)
            if (logErr) console.error('[send-reminders] log write failed', logErr.message)
          }

          try {
            const result = await sendTemplateEmail('appointment-reminder', a.contact_email, {
              idempotencyKey: messageId,
              templateData: {
                clientName: a.contact_name ?? undefined,
                artistName: a.artists?.name ?? undefined,
                whenLabel: whenLabel(a.start_at),
                servicesSummary,
              },
            })
            if (!result.sent) {
              await logRow('suppressed')
              skipped++
              continue
            }
            await logRow('sent')
            sent++
          } catch (err) {
            await logRow('failed', err instanceof Error ? err.message : 'unknown')
          }
        }


        return Response.json({ ok: true, considered: rows.length, sent, skipped })
      },
    },
  },
})