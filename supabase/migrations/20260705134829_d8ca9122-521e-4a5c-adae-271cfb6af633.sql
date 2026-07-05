-- 1. current_seller_id()
CREATE OR REPLACE FUNCTION public.current_seller_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT seller_id FROM public.app_users WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.current_seller_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_seller_id() TO authenticated, service_role;

-- 2. Appointments RLS (seller)
DROP POLICY IF EXISTS appt_seller_select ON public.appointments;
CREATE POLICY appt_seller_select ON public.appointments
  FOR SELECT
  USING (current_user_role() = 'seller'::user_role
         AND seller_id IS NOT NULL
         AND seller_id = current_seller_id());

DROP POLICY IF EXISTS appt_seller_insert ON public.appointments;
CREATE POLICY appt_seller_insert ON public.appointments
  FOR INSERT
  WITH CHECK (current_user_role() = 'seller'::user_role
              AND seller_id IS NOT NULL
              AND seller_id = current_seller_id());

-- 3. appointment_services (seller read + insert)
DROP POLICY IF EXISTS appt_svc_seller_read ON public.appointment_services;
CREATE POLICY appt_svc_seller_read ON public.appointment_services
  FOR SELECT
  USING (current_user_role() = 'seller'::user_role
         AND appointment_id IN (
           SELECT id FROM public.appointments
           WHERE seller_id = current_seller_id()
         ));

DROP POLICY IF EXISTS appt_svc_seller_insert ON public.appointment_services;
CREATE POLICY appt_svc_seller_insert ON public.appointment_services
  FOR INSERT
  WITH CHECK (current_user_role() = 'seller'::user_role
              AND appointment_id IN (
                SELECT id FROM public.appointments
                WHERE seller_id = current_seller_id()
              ));

-- 4. payments (seller read + insert)
DROP POLICY IF EXISTS pay_seller_read ON public.payments;
CREATE POLICY pay_seller_read ON public.payments
  FOR SELECT
  USING (current_user_role() = 'seller'::user_role
         AND appointment_id IN (
           SELECT id FROM public.appointments
           WHERE seller_id = current_seller_id()
         ));

DROP POLICY IF EXISTS pay_seller_insert ON public.payments;
CREATE POLICY pay_seller_insert ON public.payments
  FOR INSERT
  WITH CHECK (current_user_role() = 'seller'::user_role
              AND appointment_id IN (
                SELECT id FROM public.appointments
                WHERE seller_id = current_seller_id()
              ));

-- 5. get_monthly_report: include seller scoping
CREATE OR REPLACE FUNCTION public.get_monthly_report(
  p_month integer,
  p_year integer,
  p_artist uuid DEFAULT NULL::uuid,
  p_status text DEFAULT NULL::text,
  p_style text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, nome_do_cliente text, artista text, artist_id uuid,
              data_e_hora timestamp with time zone, estilo_de_tatuagem text,
              tamanho_da_tatuagem text, notas text, status_pt text,
              valor numeric, comissao_pct numeric, comissao_eur numeric,
              ghl_contact_id text, ghl_calendar_id text,
              criado_em timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role user_role;
  v_artist_id uuid;
  v_seller_id uuid;
  v_status appt_status;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  v_role := public.current_user_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
  v_end := v_start + interval '1 month';

  IF p_status IS NOT NULL THEN
    v_status := CASE lower(p_status)
      WHEN 'agendado'   THEN 'pending'::appt_status
      WHEN 'confirmado' THEN 'confirmed'::appt_status
      WHEN 'concluido'  THEN 'completed'::appt_status
      WHEN 'concluído'  THEN 'completed'::appt_status
      WHEN 'cancelado'  THEN 'cancelled'::appt_status
      WHEN 'no_show'    THEN 'no_show'::appt_status
      ELSE p_status::appt_status
    END;
  END IF;

  IF v_role = 'artist'::user_role THEN
    v_artist_id := public.current_artist_id();
    IF v_artist_id IS NULL THEN
      RAISE EXCEPTION 'artist not linked';
    END IF;
  ELSIF v_role = 'seller'::user_role THEN
    v_seller_id := public.current_seller_id();
    IF v_seller_id IS NULL THEN
      RAISE EXCEPTION 'seller not linked';
    END IF;
  ELSE
    v_artist_id := p_artist;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.contact_name,
    ar.name,
    a.artist_id,
    a.start_at,
    a.tattoo_style,
    a.tattoo_size,
    a.notes,
    CASE a.status
      WHEN 'pending'   THEN 'agendado'
      WHEN 'confirmed' THEN 'confirmado'
      WHEN 'completed' THEN 'concluido'
      WHEN 'cancelled' THEN 'cancelado'
      WHEN 'no_show'   THEN 'no_show'
    END,
    CASE
      WHEN v_role = 'admin'::user_role THEN a.total_eur
      WHEN v_role = 'seller'::user_role THEN a.total_eur
      ELSE NULL
    END,
    CASE
      WHEN v_role = 'admin'::user_role THEN a.commission_pct
      WHEN v_role = 'seller'::user_role THEN
        (SELECT s.commission_pct FROM public.sellers s WHERE s.id = a.seller_id)
      ELSE NULL
    END,
    CASE
      WHEN v_role = 'admin'::user_role
        THEN round((a.total_eur * a.commission_pct) / 100.0, 2)
      WHEN v_role = 'seller'::user_role
        THEN round((a.total_eur * COALESCE(
          (SELECT s.commission_pct FROM public.sellers s WHERE s.id = a.seller_id), 0
        )) / 100.0, 2)
      ELSE NULL
    END,
    a.ghl_contact_id,
    a.calendar_id,
    a.created_at
  FROM public.appointments a
  LEFT JOIN public.artists ar ON ar.id = a.artist_id
  WHERE a.start_at >= v_start
    AND a.start_at < v_end
    AND (
      (v_role = 'seller'::user_role AND a.seller_id = v_seller_id)
      OR (v_role <> 'seller'::user_role
          AND (v_artist_id IS NULL OR a.artist_id = v_artist_id))
    )
    AND (p_status IS NULL OR a.status = v_status)
    AND (p_style IS NULL OR a.tattoo_style ILIKE '%' || p_style || '%');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_monthly_report(integer,integer,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_report(integer,integer,uuid,text,text) TO authenticated, service_role;

-- 6. get_my_seller_appointments — read-only view for logged seller
CREATE OR REPLACE FUNCTION public.get_my_seller_appointments()
RETURNS TABLE(
  id uuid,
  artist_id uuid,
  seller_id uuid,
  contact_id uuid,
  ghl_appointment_id text,
  calendar_id text,
  contact_name text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  notes text,
  total_eur numeric,
  commission_pct numeric,
  commission_eur numeric,
  created_at timestamptz,
  updated_at timestamptz,
  services_summary text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    a.id,
    a.artist_id,
    a.seller_id,
    a.contact_id,
    a.ghl_appointment_id,
    a.calendar_id,
    a.contact_name,
    a.start_at,
    a.end_at,
    a.status::text,
    a.notes,
    a.total_eur,
    s.commission_pct,
    round((a.total_eur * COALESCE(s.commission_pct, 0)) / 100.0, 2) AS commission_eur,
    a.created_at,
    a.updated_at,
    (SELECT COALESCE(string_agg(sv.value->>'name', ', '), '')
       FROM jsonb_array_elements(a.services) sv) AS services_summary
  FROM public.appointments a
  LEFT JOIN public.sellers s ON s.id = a.seller_id
  WHERE public.current_user_role() = 'seller'::user_role
    AND a.seller_id IS NOT NULL
    AND a.seller_id = public.current_seller_id();
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_seller_appointments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_seller_appointments() TO authenticated, service_role;