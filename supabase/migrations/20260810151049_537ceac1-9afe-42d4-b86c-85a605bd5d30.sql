-- 1) Enum de status da fila
DO $$ BEGIN
  CREATE TYPE public.checkin_status AS ENUM ('aguardando','em_atendimento','concluido','nao_compareceu','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela
CREATE TABLE public.checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  cliente_nome text NOT NULL,
  cliente_telefone text,

  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ghl_contact_id text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ghl_appointment_id text,
  ghl_opportunity_id text,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,

  codigo_atendimento text NOT NULL,
  status public.checkin_status NOT NULL DEFAULT 'aguardando',

  arrived_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  scheduled_at timestamptz,
  source text NOT NULL DEFAULT 'Totem GF',

  qr_token text NOT NULL UNIQUE,
  qr_url text,
  qr_created_at timestamptz NOT NULL DEFAULT now(),
  qr_expires_at timestamptz,

  consentimento_comunicacao boolean NOT NULL DEFAULT false,
  notificado_em timestamptz,

  -- preparados para uma fase futura; sem uso nem UI agora
  photo_url text,
  photo_consent boolean,
  photo_taken_at timestamptz,

  ghl_sync_status public.movimentacao_sync_status NOT NULL DEFAULT 'pending',
  ghl_sync_error text,
  ghl_sync_attempts integer NOT NULL DEFAULT 0,
  ghl_last_synced_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_select_staff" ON public.checkins
  FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "checkins_insert_staff" ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IS NOT NULL);

CREATE POLICY "checkins_update_staff" ON public.checkins
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IS NOT NULL)
  WITH CHECK (public.current_user_role() IS NOT NULL);

CREATE TRIGGER checkins_set_updated_at
  BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Índices
CREATE INDEX checkins_arrived_idx ON public.checkins (arrived_at DESC);
CREATE INDEX checkins_status_idx ON public.checkins (status);

-- anti-duplicidade: um check-in ativo por cliente por dia
CREATE UNIQUE INDEX checkins_active_daily_uniq
  ON public.checkins (
    COALESCE(ghl_contact_id, contact_id::text, cliente_telefone),
    ((arrived_at AT TIME ZONE 'Europe/Brussels')::date)
  )
  WHERE status IN ('aguardando','em_atendimento')
    AND COALESCE(ghl_contact_id, contact_id::text, cliente_telefone) IS NOT NULL;

-- 4) Código curto do atendimento (GF-001 por dia)
CREATE OR REPLACE FUNCTION public.next_checkin_codigo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) + 1 INTO v_n
    FROM public.checkins
   WHERE (arrived_at AT TIME ZONE 'Europe/Brussels')::date
       = (now() AT TIME ZONE 'Europe/Brussels')::date;
  RETURN 'GF-' || lpad(v_n::text, 3, '0');
END;
$$;

-- 5) Leitura pública por token: apenas dados autorizados ao cliente
CREATE OR REPLACE FUNCTION public.get_checkin_by_token(p_token text)
RETURNS TABLE(
  codigo_atendimento text,
  status text,
  scheduled_at timestamptz,
  arrived_at timestamptz,
  tatuador_primeiro_nome text,
  expirado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.codigo_atendimento,
    c.status::text,
    c.scheduled_at,
    c.arrived_at,
    split_part(COALESCE(a.name, ''), ' ', 1),
    (c.qr_expires_at IS NOT NULL AND c.qr_expires_at < now())
  FROM public.checkins c
  LEFT JOIN public.artists a ON a.id = c.artist_id
  WHERE c.qr_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_checkin_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkin_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_checkin_codigo() TO authenticated, service_role;

-- 6) Fila do dia para a equipe
CREATE OR REPLACE FUNCTION public.list_checkins_hoje()
RETURNS TABLE(
  id uuid,
  cliente_nome text,
  codigo_atendimento text,
  status text,
  arrived_at timestamptz,
  started_at timestamptz,
  scheduled_at timestamptz,
  artist_id uuid,
  tatuador text,
  appointment_id uuid,
  ghl_sync_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT c.id, c.cliente_nome, c.codigo_atendimento, c.status::text,
         c.arrived_at, c.started_at, c.scheduled_at,
         c.artist_id, a.name, c.appointment_id, c.ghl_sync_status::text
    FROM public.checkins c
    LEFT JOIN public.artists a ON a.id = c.artist_id
   WHERE (c.arrived_at AT TIME ZONE 'Europe/Brussels')::date
       = (now() AT TIME ZONE 'Europe/Brussels')::date
   ORDER BY
     CASE c.status WHEN 'em_atendimento' THEN 0 WHEN 'aguardando' THEN 1 ELSE 2 END,
     c.arrived_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_checkins_hoje() TO authenticated, service_role;