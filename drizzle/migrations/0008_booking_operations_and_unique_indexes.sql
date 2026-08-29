CREATE TABLE public.booking_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  step text NOT NULL DEFAULT 'validated',
  status text NOT NULL DEFAULT 'in_progress',
  artist_id uuid REFERENCES public.artists(id),
  start_at timestamptz,
  ghl_contact_id text,
  ghl_opportunity_id text,
  ghl_appointment_id text,
  project_id uuid REFERENCES public.tattoo_projects(id),
  appointment_id uuid REFERENCES public.appointments(id),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX booking_operations_idempotency_key ON public.booking_operations (idempotency_key);
CREATE INDEX booking_operations_status_idx ON public.booking_operations (status, created_at DESC);

GRANT SELECT ON public.booking_operations TO authenticated;
GRANT ALL ON public.booking_operations TO service_role;

ALTER TABLE public.booking_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem operações de agendamento"
  ON public.booking_operations FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin'::user_role);

CREATE TRIGGER booking_operations_set_updated_at
  BEFORE UPDATE ON public.booking_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS appointments_ghl_appointment_id_key
  ON public.appointments (ghl_appointment_id)
  WHERE ghl_appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tattoo_projects_chave_idempotencia_key
  ON public.tattoo_projects (chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;