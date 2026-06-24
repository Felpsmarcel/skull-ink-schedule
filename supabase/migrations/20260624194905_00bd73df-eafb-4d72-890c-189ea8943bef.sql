
DROP VIEW IF EXISTS public.appointments_artist_view;

CREATE VIEW public.appointments_artist_view
WITH (security_invoker = off) AS
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
