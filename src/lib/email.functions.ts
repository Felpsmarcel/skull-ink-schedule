import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SendEmailInput } from "@/lib/email/schema";

/**
 * Sends one registered app email to one recipient. Authenticated callers only —
 * the template name is restricted to the app's own notification templates.
 */
export const sendAppEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendEmailInput.parse(d))
  .handler(async ({ data }) => {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail(data.templateName, data.recipientEmail, {
      templateData: data.templateData ?? {},
      ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
    });
    return result;
  });
