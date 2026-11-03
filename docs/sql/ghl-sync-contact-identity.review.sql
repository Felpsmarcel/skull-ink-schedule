-- REVIEW ONLY. Not applied. Replace ghl_sync_write in the staged migration
-- through the authorized migration workflow before any future activation.
CREATE OR REPLACE FUNCTION public.ghl_sync_write(p_run uuid, p_kind text, p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM 1 FROM public.ghl_sync_lease WHERE singleton AND run_id=p_run AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sync lease expired'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'invalid sync batch'; END IF;
  IF p_kind IN ('insert','update') THEN
    -- SHARE prevents concurrent identity/snapshot changes until this write commits.
    PERFORM 1 FROM public.contacts c JOIN jsonb_to_recordset(p_rows) x(contact_id uuid)
      ON c.id=x.contact_id FOR SHARE OF c;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_rows) x(contact_id uuid,ghl_contact_id text,contact_name text,contact_phone text,contact_email text)
      LEFT JOIN public.contacts c ON c.id=x.contact_id
      WHERE c.id IS NULL OR nullif(btrim(x.ghl_contact_id),'') IS NULL
        OR c.ghl_contact_id IS DISTINCT FROM x.ghl_contact_id
        OR c.name IS DISTINCT FROM x.contact_name
        OR c.phone IS DISTINCT FROM x.contact_phone
        OR c.email IS DISTINCT FROM x.contact_email
    ) THEN RAISE EXCEPTION 'contact identity conflict'; END IF;
  END IF;
  IF p_kind='contacts' THEN
    WITH changed AS (
      INSERT INTO public.contacts(ghl_contact_id,name,phone,email)
      SELECT ghl_contact_id,name,phone,email FROM jsonb_to_recordset(p_rows) AS x(ghl_contact_id text,name text,phone text,email text)
      ON CONFLICT(ghl_contact_id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email
      RETURNING id,ghl_contact_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSIF p_kind='insert' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_rows) x(artist_id uuid,calendar_id text,commission_pct numeric)
      LEFT JOIN public.artists a ON a.id=x.artist_id
      WHERE a.id IS NULL OR NOT a.active OR a.ghl_calendar_id IS DISTINCT FROM x.calendar_id
        OR a.commission_pct IS DISTINCT FROM x.commission_pct OR x.commission_pct IS NULL
    ) THEN RAISE EXCEPTION 'calendar or commission conflict'; END IF;
    WITH changed AS (
      INSERT INTO public.appointments(ghl_appointment_id,ghl_contact_id,contact_id,artist_id,calendar_id,contact_name,contact_phone,contact_email,start_at,end_at,status,commission_pct,notes)
      SELECT ghl_appointment_id,ghl_contact_id,contact_id,artist_id,calendar_id,contact_name,contact_phone,contact_email,start_at,end_at,status::public.appt_status,commission_pct,notes
      FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,ghl_contact_id text,contact_id uuid,artist_id uuid,calendar_id text,contact_name text,contact_phone text,contact_email text,start_at timestamptz,end_at timestamptz,status text,commission_pct numeric,notes text)
      ON CONFLICT(ghl_appointment_id) DO NOTHING RETURNING ghl_appointment_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSIF p_kind='update' THEN
    PERFORM 1 FROM public.appointments a JOIN jsonb_to_recordset(p_rows) x(ghl_appointment_id text)
      ON a.ghl_appointment_id=x.ghl_appointment_id FOR UPDATE OF a;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,artist_id uuid,calendar_id text)
      LEFT JOIN public.appointments a ON a.ghl_appointment_id=x.ghl_appointment_id
      WHERE a.id IS NULL OR a.artist_id IS DISTINCT FROM x.artist_id OR a.calendar_id IS DISTINCT FROM x.calendar_id
    ) THEN RAISE EXCEPTION 'event ownership conflict'; END IF;
    WITH changed AS (
      UPDATE public.appointments a SET start_at=x.start_at,end_at=x.end_at,status=x.status::public.appt_status,
        contact_name=x.contact_name,contact_phone=x.contact_phone,
        contact_email=x.contact_email,ghl_contact_id=x.ghl_contact_id,contact_id=x.contact_id
      FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,start_at timestamptz,end_at timestamptz,status text,contact_name text,contact_phone text,contact_email text,ghl_contact_id text,contact_id uuid)
      WHERE a.ghl_appointment_id=x.ghl_appointment_id RETURNING a.ghl_appointment_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSE RAISE EXCEPTION 'invalid sync operation'; END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ghl_sync_write(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghl_sync_write(uuid,text,jsonb) TO service_role;