
-- 1) Replace artist SELECT policy on appointments: block direct table read entirely.
DROP POLICY IF EXISTS appt_artist_select ON public.appointments;
CREATE POLICY appt_artist_select_blocked
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin'::user_role);
  -- artists fall through and get no row from this table via PostgREST.

-- 2) Safe artist-facing view: no total_eur, no original_eur, no services jsonb, no studio share.
CREATE OR REPLACE VIEW public.appointments_artist_view
WITH (security_invoker = on) AS
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
  ROUND((a.total_eur * a.commission_pct / 100.0)::numeric, 2) AS commission_eur,
  a.commission_pct,
  a.created_at,
  a.updated_at,
  (
    SELECT COALESCE(string_agg(s->>'name', ', '), '')
    FROM jsonb_array_elements(a.services) s
  ) AS services_summary
FROM public.appointments a
WHERE
  current_user_role() = 'admin'::user_role
  OR (current_user_role() = 'artist'::user_role AND a.artist_id = current_artist_id());

GRANT SELECT ON public.appointments_artist_view TO authenticated;
