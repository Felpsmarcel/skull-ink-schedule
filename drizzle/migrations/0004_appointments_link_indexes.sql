CREATE INDEX appointments_project_id_idx ON public.appointments (project_id);
CREATE INDEX appointments_ghl_opportunity_id_idx ON public.appointments (ghl_opportunity_id);
CREATE UNIQUE INDEX appointments_chave_idempotencia_key ON public.appointments (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;