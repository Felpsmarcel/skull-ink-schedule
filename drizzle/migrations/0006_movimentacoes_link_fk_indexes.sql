ALTER TABLE public.movimentacoes
  ADD CONSTRAINT movimentacoes_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.tattoo_projects(id) ON DELETE SET NULL;

ALTER TABLE public.movimentacoes
  ADD CONSTRAINT movimentacoes_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX movimentacoes_project_id_idx ON public.movimentacoes (project_id);
CREATE INDEX movimentacoes_appointment_id_idx ON public.movimentacoes (appointment_id);