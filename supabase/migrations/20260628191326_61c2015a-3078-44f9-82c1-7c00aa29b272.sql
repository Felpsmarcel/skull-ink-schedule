
DROP POLICY IF EXISTS artists_auth_read ON public.artists;
DROP POLICY IF EXISTS artists_public_columns_read ON public.artists;

CREATE POLICY artists_authenticated_read
  ON public.artists
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.artists FROM authenticated;
GRANT SELECT (id, ghl_user_id, ghl_calendar_id, name, avatar_url, specialties, bio, active, created_at)
  ON public.artists TO authenticated;
GRANT SELECT ON public.artists TO service_role;

CREATE OR REPLACE VIEW public.artists_public
WITH (security_invoker = on) AS
SELECT id, ghl_user_id, ghl_calendar_id, name, avatar_url, specialties, bio, active, created_at
FROM public.artists;

GRANT SELECT ON public.artists_public TO authenticated, service_role;

DROP VIEW IF EXISTS public.appointments_artist_view;

CREATE OR REPLACE FUNCTION public.get_my_artist_appointments()
RETURNS TABLE (
  id uuid,
  artist_id uuid,
  contact_id uuid,
  ghl_appointment_id text,
  calendar_id text,
  contact_name text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  notes text,
  commission_eur numeric,
  commission_pct numeric,
  created_at timestamptz,
  updated_at timestamptz,
  services_summary text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.artist_id,
    a.contact_id,
    a.ghl_appointment_id,
    a.calendar_id,
    a.contact_name,
    a.start_at,
    a.end_at,
    a.status,
    a.notes,
    round((a.total_eur * a.commission_pct) / 100.0, 2) AS commission_eur,
    a.commission_pct,
    a.created_at,
    a.updated_at,
    (SELECT COALESCE(string_agg(s.value->>'name', ', '), '')
       FROM jsonb_array_elements(a.services) s) AS services_summary
  FROM public.appointments a
  WHERE
    current_user_role() = 'admin'::user_role
    OR (current_user_role() = 'artist'::user_role AND a.artist_id = current_artist_id());
$$;

REVOKE ALL ON FUNCTION public.get_my_artist_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_artist_appointments() TO authenticated, service_role;
