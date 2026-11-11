-- REVIEW-ONLY. NÃO APLICAR sem aprovação. Persistência futura do rascunho de distribuição
-- e da seleção de oportunidade. Hoje o rascunho fica só no aparelho (localStorage).
CREATE TABLE public.project_session_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  frozen_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, appointment_id)
);
GRANT SELECT, INSERT, UPDATE ON public.project_session_allocations TO authenticated;
GRANT ALL ON public.project_session_allocations TO service_role;
ALTER TABLE public.project_session_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY psa_admin ON public.project_session_allocations FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');
-- Invariantes a validar em RPC admin: sessão pertence ao projeto; não cancelada;
-- soma <= tattoo_projects.quoted_total_eur*100; linhas com frozen_at imutáveis.
