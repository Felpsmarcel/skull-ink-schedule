
-- Drop legacy services table (empty, incompatible shape)
DROP TABLE IF EXISTS public.services CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ──────────────────────────────────────
DO $$ BEGIN CREATE TYPE user_role        AS ENUM ('admin','artist'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appt_status      AS ENUM ('pending','confirmed','cancelled','completed','no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE quote_status     AS ENUM ('draft','sent','accepted','rejected','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_type     AS ENUM ('deposit','final','refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method   AS ENUM ('cash','card','transfer','payconiq','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status   AS ENUM ('pending','paid','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE service_modality AS ENUM ('presencial','consulta_online','hibrido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. ARTISTS ─────────────────────────────────
CREATE TABLE public.artists (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_user_id     text UNIQUE,
  ghl_calendar_id text UNIQUE,
  name            text NOT NULL,
  email           text,
  phone           text,
  specialties     text[] DEFAULT '{}',
  bio             text,
  avatar_url      text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artists TO anon, authenticated;
GRANT ALL ON public.artists TO service_role;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- ── 2. APP_USERS ───────────────────────────────
CREATE TABLE public.app_users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id  uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  role       user_role NOT NULL DEFAULT 'artist',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- ── 3. SERVICES ────────────────────────────────
CREATE TABLE public.services (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  category     text NOT NULL,
  duration_min int NOT NULL CHECK (duration_min > 0),
  modality     service_modality NOT NULL DEFAULT 'presencial',
  price_eur    numeric(8,2) NOT NULL CHECK (price_eur >= 0),
  description  text,
  active       boolean NOT NULL DEFAULT true,
  sort_order   int DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- ── 4. CONTACTS ────────────────────────────────
CREATE TABLE public.contacts (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_contact_id text UNIQUE NOT NULL,
  name           text NOT NULL,
  email          text,
  phone          text,
  tags           text[] DEFAULT '{}',
  notes          text,
  synced_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- ── 5. APPOINTMENTS ────────────────────────────
CREATE TABLE public.appointments (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_appointment_id text UNIQUE,
  contact_id         uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  artist_id          uuid NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  start_at           timestamptz NOT NULL,
  end_at             timestamptz NOT NULL,
  status             appt_status NOT NULL DEFAULT 'pending',
  notes              text,
  internal_note      text,
  discount_eur       numeric(8,2) DEFAULT 0,
  created_by         uuid REFERENCES public.app_users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ── 6. APPOINTMENT_SERVICES ────────────────────
CREATE TABLE public.appointment_services (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id     uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  price_eur      numeric(8,2) NOT NULL,
  duration_min   int NOT NULL,
  quantity       int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (appointment_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- ── 7. QUOTES ──────────────────────────────────
CREATE TABLE public.quotes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  artist_id     uuid NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  services_snap jsonb NOT NULL DEFAULT '[]',
  subtotal_eur  numeric(8,2) NOT NULL DEFAULT 0,
  discount_eur  numeric(8,2) NOT NULL DEFAULT 0,
  total_eur     numeric(8,2) NOT NULL DEFAULT 0,
  status        quote_status NOT NULL DEFAULT 'draft',
  valid_until   date,
  notes         text,
  created_by    uuid REFERENCES public.app_users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- ── 8. PAYMENTS ────────────────────────────────
CREATE TABLE public.payments (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  quote_id       uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  contact_id     uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  amount_eur     numeric(8,2) NOT NULL CHECK (amount_eur > 0),
  type           payment_type NOT NULL,
  method         payment_method NOT NULL,
  status         payment_status NOT NULL DEFAULT 'pending',
  paid_at        timestamptz,
  notes          text,
  created_by     uuid REFERENCES public.app_users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ── 9. PORTFOLIO ───────────────────────────────
CREATE TABLE public.portfolio (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id   uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  image_url   text NOT NULL,
  tags        text[] DEFAULT '{}',
  published   boolean NOT NULL DEFAULT false,
  sort_order  int DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio TO authenticated;
GRANT ALL ON public.portfolio TO service_role;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;

-- ── 10. AVAILABILITY_BLOCKS ────────────────────
CREATE TABLE public.availability_blocks (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id    uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  ghl_block_id text,
  start_at     timestamptz NOT NULL,
  end_at       timestamptz NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_blocks TO authenticated;
GRANT ALL ON public.availability_blocks TO service_role;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

-- ── INDEXES ────────────────────────────────────
CREATE INDEX idx_appt_artist_start  ON public.appointments(artist_id, start_at);
CREATE INDEX idx_appt_contact       ON public.appointments(contact_id);
CREATE INDEX idx_appt_status        ON public.appointments(status);
CREATE INDEX idx_appt_ghl           ON public.appointments(ghl_appointment_id) WHERE ghl_appointment_id IS NOT NULL;
CREATE INDEX idx_appt_svc_appt      ON public.appointment_services(appointment_id);
CREATE INDEX idx_contacts_ghl       ON public.contacts(ghl_contact_id);
CREATE INDEX idx_payments_appt      ON public.payments(appointment_id);
CREATE INDEX idx_portfolio_artist   ON public.portfolio(artist_id);
CREATE INDEX idx_avail_artist_start ON public.availability_blocks(artist_id, start_at);

-- ── UPDATED_AT TRIGGER ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── HELPERS ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.app_users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_artist_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT artist_id FROM public.app_users WHERE id = auth.uid();
$$;

-- ── POLICIES ───────────────────────────────────

-- artists: public read of active row while no auth; admin write later
CREATE POLICY "artists_public_read" ON public.artists FOR SELECT USING (true);
CREATE POLICY "artists_write_admin" ON public.artists FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- app_users
CREATE POLICY "app_users_self" ON public.app_users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin');
CREATE POLICY "app_users_admin_write" ON public.app_users FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- services: public read; admin write later
CREATE POLICY "services_public_read" ON public.services FOR SELECT USING (true);
CREATE POLICY "services_write_admin" ON public.services FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- contacts
CREATE POLICY "contacts_admin" ON public.contacts FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "contacts_artist_read" ON public.contacts FOR SELECT TO authenticated USING (
  public.current_user_role() = 'artist' AND
  id IN (SELECT contact_id FROM public.appointments WHERE artist_id = public.current_artist_id())
);

-- appointments
CREATE POLICY "appt_admin" ON public.appointments FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "appt_artist_select" ON public.appointments FOR SELECT TO authenticated USING (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
);
CREATE POLICY "appt_artist_update" ON public.appointments FOR UPDATE TO authenticated USING (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
) WITH CHECK (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
);

-- appointment_services
CREATE POLICY "appt_svc_admin" ON public.appointment_services FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "appt_svc_artist_read" ON public.appointment_services FOR SELECT TO authenticated USING (
  public.current_user_role() = 'artist' AND
  appointment_id IN (SELECT id FROM public.appointments WHERE artist_id = public.current_artist_id())
);

-- quotes
CREATE POLICY "quotes_admin" ON public.quotes FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "quotes_artist_read" ON public.quotes FOR SELECT TO authenticated USING (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
);

-- payments
CREATE POLICY "pay_admin" ON public.payments FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "pay_artist_read" ON public.payments FOR SELECT TO authenticated USING (
  public.current_user_role() = 'artist' AND
  appointment_id IN (SELECT id FROM public.appointments WHERE artist_id = public.current_artist_id())
);

-- portfolio
CREATE POLICY "portfolio_public" ON public.portfolio FOR SELECT USING (published = true);
CREATE POLICY "portfolio_admin" ON public.portfolio FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "portfolio_artist" ON public.portfolio FOR ALL TO authenticated USING (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
) WITH CHECK (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
);

-- availability_blocks
CREATE POLICY "avail_admin" ON public.availability_blocks FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "avail_artist" ON public.availability_blocks FOR ALL TO authenticated USING (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
) WITH CHECK (
  public.current_user_role() = 'artist' AND artist_id = public.current_artist_id()
);

-- ── SEED: ARTISTS ──────────────────────────────
INSERT INTO public.artists (ghl_user_id, ghl_calendar_id, name, email, phone, specialties, active) VALUES
  ('bFfSIHXorhaCUvcM0UIU', '9PS3KanirlXnDSO63ZYY', 'Gabriel Fernandes', 'contatodegabriel@gmail.com', '+5571992036764', ARRAY['Cover-up','Blackwork'], true),
  ('FMju5MHBXiXOzLXtBrA2', 'suBooHKzS7WTsdHOIiHJ', 'Andre Pareyn',      'andrepareyn7508@gmail.com', '+32465271070',   ARRAY[]::text[],            true),
  ('FZBsfiRSCzfviKR3fEVh', '8YftfNNqLrONHHP2RQkd', 'Neto Mendes',       NULL, NULL, ARRAY[]::text[], true),
  ('MmNZUW7IedFpLJ3SYNLQ', 'BMolaQM8M3kQDiKxFNxZ', 'Maciel Tattoo',     NULL, NULL, ARRAY[]::text[], true);
