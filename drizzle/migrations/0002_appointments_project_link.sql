ALTER TABLE public.appointments ADD COLUMN project_id uuid;
ALTER TABLE public.appointments ADD COLUMN ghl_opportunity_id text;
ALTER TABLE public.appointments ADD COLUMN chave_idempotencia text;