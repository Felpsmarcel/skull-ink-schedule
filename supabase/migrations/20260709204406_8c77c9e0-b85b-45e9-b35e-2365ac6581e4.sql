
DROP FUNCTION IF EXISTS public.get_my_artist_appointments();
DROP FUNCTION IF EXISTS public.get_my_seller_appointments();

CREATE OR REPLACE FUNCTION public.get_my_artist_appointments()
 RETURNS TABLE(id uuid, artist_id uuid, contact_id uuid, ghl_appointment_id text, calendar_id text, contact_name text, start_at timestamp with time zone, end_at timestamp with time zone, status text, notes text, commission_eur numeric, commission_pct numeric, manual_payment_status text, created_at timestamp with time zone, updated_at timestamp with time zone, services_summary text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.id, a.artist_id, a.contact_id, a.ghl_appointment_id, a.calendar_id,
    a.contact_name, a.start_at, a.end_at, a.status::text, a.notes,
    round((a.total_eur * a.commission_pct) / 100.0, 2) AS commission_eur,
    a.commission_pct,
    a.manual_payment_status,
    a.created_at, a.updated_at,
    (SELECT COALESCE(string_agg(s.value->>'name', ', '), '')
       FROM jsonb_array_elements(a.services) s) AS services_summary
  FROM public.appointments a
  WHERE
    current_user_role() = 'admin'::user_role
    OR (current_user_role() = 'artist'::user_role AND a.artist_id = current_artist_id());
$function$;

CREATE OR REPLACE FUNCTION public.get_my_seller_appointments()
 RETURNS TABLE(id uuid, artist_id uuid, seller_id uuid, contact_id uuid, ghl_appointment_id text, calendar_id text, contact_name text, start_at timestamp with time zone, end_at timestamp with time zone, status text, notes text, total_eur numeric, commission_pct numeric, commission_eur numeric, manual_payment_status text, created_at timestamp with time zone, updated_at timestamp with time zone, services_summary text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.id, a.artist_id, a.seller_id, a.contact_id, a.ghl_appointment_id, a.calendar_id,
    a.contact_name, a.start_at, a.end_at, a.status::text, a.notes,
    a.total_eur, s.commission_pct,
    round((a.total_eur * COALESCE(s.commission_pct, 0)) / 100.0, 2) AS commission_eur,
    a.manual_payment_status,
    a.created_at, a.updated_at,
    (SELECT COALESCE(string_agg(sv.value->>'name', ', '), '')
       FROM jsonb_array_elements(a.services) sv) AS services_summary
  FROM public.appointments a
  LEFT JOIN public.sellers s ON s.id = a.seller_id
  WHERE public.current_user_role() = 'seller'::user_role
    AND a.seller_id IS NOT NULL
    AND a.seller_id = public.current_seller_id();
$function$;
