-- REVIEW ONLY. Not a deployed migration. No storage/upload endpoint is activated by this file.
-- Prerequisites: inspect ALL existing storage.objects policies; broad policies combine with OR.
-- Never activate until user-context and storage integration tests pass against staging.

CREATE TABLE public.project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('reference', 'before', 'progress', 'result')),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 10000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  UNIQUE (project_id, created_by, request_id),
  CHECK (storage_path = project_id::text || '/' || id::text)
);
CREATE INDEX project_photos_project_created_idx ON public.project_photos(project_id, created_at, id);
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos FORCE ROW LEVEL SECURITY;

-- Caller identity comes from auth.uid(), never an artist ID or email supplied by the client.
CREATE FUNCTION public.project_photo_can_read(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users actor
    JOIN public.tattoo_projects project ON project.id = p_project_id
    WHERE actor.id = auth.uid()
      AND (actor.role::text = 'admin'
        OR (actor.role::text = 'artist' AND actor.artist_id IS NOT NULL
          AND project.artist_id = actor.artist_id))
  );
$$;
REVOKE ALL ON FUNCTION public.project_photo_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_photo_can_read(uuid) TO authenticated;
REVOKE ALL ON public.project_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_photos TO authenticated;
GRANT ALL ON public.project_photos TO service_role;
CREATE POLICY project_photos_scoped_read ON public.project_photos
  FOR SELECT TO authenticated USING (public.project_photo_can_read(project_id));

-- Writes remain service-only until purpose-built handlers implement authorization,
-- content validation, idempotency, removal audit and storage/metadata reconciliation.
-- No authenticated INSERT / UPDATE / DELETE grant or policy is created.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-photos-private', 'project-photos-private', false, 10000000,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-photos-private' AND public) THEN
    RAISE EXCEPTION 'project_photos_bucket_must_be_private';
  END IF;
END $$;
CREATE POLICY project_photos_private_object_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'project-photos-private'
    AND EXISTS (SELECT 1 FROM public.project_photos photo
      WHERE photo.storage_path = storage.objects.name
        AND public.project_photo_can_read(photo.project_id))
  );
-- Do not introduce public URLs or direct client upload policies for this bucket.
