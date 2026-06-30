
-- Sprint 2: GHL sync infrastructure

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Table for orphaned GHL events (created in GHL but failed to mirror in app)
CREATE TABLE public.ghl_sync_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_event_id text,
  reason text NOT NULL,
  payload jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ghl_sync_failures_open_idx
  ON public.ghl_sync_failures (created_at DESC) WHERE resolved_at IS NULL;

GRANT SELECT, UPDATE ON public.ghl_sync_failures TO authenticated;
GRANT ALL ON public.ghl_sync_failures TO service_role;

ALTER TABLE public.ghl_sync_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY ghl_sync_failures_admin_read
  ON public.ghl_sync_failures FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin'::public.user_role);

CREATE POLICY ghl_sync_failures_admin_resolve
  ON public.ghl_sync_failures FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin'::public.user_role)
  WITH CHECK (public.current_user_role() = 'admin'::public.user_role);

CREATE TRIGGER ghl_sync_failures_set_updated_at
  BEFORE UPDATE ON public.ghl_sync_failures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
