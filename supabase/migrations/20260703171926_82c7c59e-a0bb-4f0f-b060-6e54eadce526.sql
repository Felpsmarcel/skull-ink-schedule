
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sellers"
  ON public.sellers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage sellers - insert"
  ON public.sellers FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

CREATE POLICY "Admins manage sellers - update"
  ON public.sellers FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin'::user_role)
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

CREATE POLICY "Admins manage sellers - delete"
  ON public.sellers FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin'::user_role);

CREATE TRIGGER set_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add seller_id to appointments
ALTER TABLE public.appointments
  ADD COLUMN seller_id uuid NULL REFERENCES public.sellers(id) ON DELETE SET NULL;

CREATE INDEX idx_appointments_seller_id ON public.appointments(seller_id);

-- Seed initial sellers
INSERT INTO public.sellers (name, commission_pct, active) VALUES
  ('Leonardo', 0, true),
  ('Juliane', 0, true),
  ('Nívia', 0, true),
  ('Felipe Fernandes', 0, true)
ON CONFLICT (name) DO NOTHING;
