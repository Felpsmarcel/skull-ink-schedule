import { sendAppEmail } from '@/lib/email.functions'
import type { APP_EMAIL_TEMPLATES } from '@/lib/email/schema'

interface SendArgs {
  templateName: (typeof APP_EMAIL_TEMPLATES)[number]
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Thin client wrapper — hands the send to the authenticated server function,
 * which sends through Lovable's managed email API. Failure is caught and
 * logged; email failure must never abort a user-facing flow.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sendAppEmail({ data: args })
    if (!result.sent) {
      return { ok: false, error: result.reason }
    }
    return { ok: true }
  } catch (err) {
    console.error('[sendTransactionalEmail] failed', err)
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
