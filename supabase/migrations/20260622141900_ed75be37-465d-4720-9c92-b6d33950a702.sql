CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  duration_min int NOT NULL CHECK (duration_min > 0),
  modality text NOT NULL DEFAULT 'Presencial',
  price_cents int NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read services"
  ON public.services
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX services_category_idx ON public.services (category) WHERE active;