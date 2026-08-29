ALTER TABLE public.movimentacoes ADD COLUMN project_id uuid;
ALTER TABLE public.movimentacoes ADD COLUMN appointment_id uuid;
ALTER TABLE public.movimentacoes ADD COLUMN ghl_appointment_id text;
ALTER TABLE public.movimentacoes ADD COLUMN sem_vinculo_justificativa text;