
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_eur numeric(10,2) NOT NULL DEFAULT 0;
