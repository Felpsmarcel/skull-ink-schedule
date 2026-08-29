CREATE TYPE public.tattoo_project_type AS ENUM ('new_tattoo', 'cover_up', 'retouch');
CREATE TYPE public.tattoo_project_status AS ENUM ('lead', 'quoted', 'scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE public.tattoo_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text,
  ghl_opportunity_id text,
  ghl_pipeline_id text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  project_type public.tattoo_project_type NOT NULL DEFAULT 'new_tattoo',
  body_part text,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  quoted_total_eur numeric(10,2) NOT NULL DEFAULT 0,
  deposit_eur numeric(10,2) NOT NULL DEFAULT 0,
  status public.tattoo_project_status NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  chave_idempotencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tattoo_projects TO authenticated;
GRANT ALL ON public.tattoo_projects TO service_role;

ALTER TABLE public.tattoo_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tattoo_projects_select_staff" ON public.tattoo_projects
  FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "tattoo_projects_insert_staff" ON public.tattoo_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IS NOT NULL);

CREATE POLICY "tattoo_projects_update_admin_or_artist" ON public.tattoo_projects
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin'::user_role OR artist_id = public.current_artist_id())
  WITH CHECK (public.current_user_role() = 'admin'::user_role OR artist_id = public.current_artist_id());

CREATE TRIGGER tattoo_projects_set_updated_at
  BEFORE UPDATE ON public.tattoo_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX tattoo_projects_ghl_opportunity_id_key
  ON public.tattoo_projects (ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX tattoo_projects_chave_idempotencia_key
  ON public.tattoo_projects (chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;

CREATE INDEX tattoo_projects_ghl_contact_id_idx ON public.tattoo_projects (ghl_contact_id);
CREATE INDEX tattoo_projects_artist_id_idx ON public.tattoo_projects (artist_id);