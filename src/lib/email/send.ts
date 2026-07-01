import { supabase } from '@/integrations/supabase/client'

interface SendArgs {
  templateName: string
  recipientEmail?: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Client-side helper — POSTs to the internal transactional send route with the
 * user's Supabase JWT. Failure is caught and logged; caller decides whether to
 * surface it. Do NOT let email failure abort a user-facing flow like checkout.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { ok: false, error: 'no_session' }
    }
    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(args),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[sendTransactionalEmail] failed', res.status, text)
      return { ok: false, error: `http_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[sendTransactionalEmail] threw', err)
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}