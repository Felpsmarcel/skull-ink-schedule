ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.tattoo_projects(id) ON DELETE SET NULL;