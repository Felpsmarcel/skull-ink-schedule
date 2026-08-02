CREATE OR REPLACE FUNCTION public.get_monthly_report(p_month integer, p_year integer, p_artist uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_style text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome_do_cliente text, artista text, artist_id uuid, data_e_hora timestamp with time zone, estilo_de_tatuagem text, tamanho_da_tatuagem text, notas text, status_pt text, valor numeric, comissao_pct numeric, comissao_eur numeric, ghl_contact_id text, ghl_calendar_id text, criado_em timestamp with time zone)
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
    COALESCE(
      NULLIF(btrim(a.contact_name), ''),
      NULLIF(NULLIF(btrim(c.name), ''), 'Sem nome')
    ),
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
  LEFT JOIN public.contacts c ON c.id = a.contact_id
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