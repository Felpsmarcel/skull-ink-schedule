
DROP POLICY IF EXISTS artists_public_read ON public.artists;
REVOKE SELECT ON public.artists FROM anon;
DROP POLICY IF EXISTS artists_auth_read ON public.artists;
CREATE POLICY artists_auth_read ON public.artists FOR SELECT TO authenticated USING (true);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_contact_id_fkey;
ALTER TABLE public.appointments ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS calendar_id    text,
  ADD COLUMN IF NOT EXISTS contact_name   text,
  ADD COLUMN IF NOT EXISTS contact_phone  text,
  ADD COLUMN IF NOT EXISTS contact_email  text,
  ADD COLUMN IF NOT EXISTS total_eur      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_eur   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2)  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS services       jsonb         NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS appointments_artist_start_idx ON public.appointments(artist_id, start_at DESC);
CREATE INDEX IF NOT EXISTS appointments_start_idx        ON public.appointments(start_at DESC);
