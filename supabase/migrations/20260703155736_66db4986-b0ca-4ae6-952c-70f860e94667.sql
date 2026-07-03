ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manual_payment_status text NULL,
  ADD COLUMN IF NOT EXISTS manual_payment_status_by uuid NULL,
  ADD COLUMN IF NOT EXISTS manual_payment_status_at timestamptz NULL;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_manual_payment_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_manual_payment_status_check
  CHECK (manual_payment_status IS NULL OR manual_payment_status IN ('pago','pendente','a_receber'));