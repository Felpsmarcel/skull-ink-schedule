
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS onboarded_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.artist_services (
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_services TO authenticated;
GRANT ALL ON public.artist_services TO service_role;

ALTER TABLE public.artist_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_artist_services" ON public.artist_services
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin'::user_role)
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

CREATE POLICY "artist_manage_own_services" ON public.artist_services
  FOR ALL TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE TABLE IF NOT EXISTS public.artist_weekly_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, weekday, start_time)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_weekly_availability TO authenticated;
GRANT ALL ON public.artist_weekly_availability TO service_role;

ALTER TABLE public.artist_weekly_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_weekly_availability" ON public.artist_weekly_availability
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin'::user_role)
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

CREATE POLICY "artist_manage_own_weekly_availability" ON public.artist_weekly_availability
  FOR ALL TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE TRIGGER trg_artist_weekly_availability_set_updated_at
  BEFORE UPDATE ON public.artist_weekly_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
