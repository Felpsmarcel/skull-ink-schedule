import { z } from "zod";

/** Templates the app is allowed to send from a client-triggered flow. */
export const APP_EMAIL_TEMPLATES = [
  "appointment-confirmation",
  "artist-new-booking",
] as const;

export const SendEmailInput = z.object({
  templateName: z.enum(APP_EMAIL_TEMPLATES),
  recipientEmail: z.string().email(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
});

export type SendEmailInputType = z.infer<typeof SendEmailInput>;
