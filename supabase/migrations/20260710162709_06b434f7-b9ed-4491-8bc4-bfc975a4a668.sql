
CREATE POLICY "artist_avatars_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artist-avatars');

CREATE POLICY "artist_avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'artist-avatars'
    AND (
      public.current_user_role() = 'admin'::user_role
      OR (split_part(name, '/', 1))::uuid = public.current_artist_id()
    )
  );

CREATE POLICY "artist_avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'artist-avatars'
    AND (
      public.current_user_role() = 'admin'::user_role
      OR (split_part(name, '/', 1))::uuid = public.current_artist_id()
    )
  );

CREATE POLICY "artist_avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'artist-avatars'
    AND (
      public.current_user_role() = 'admin'::user_role
      OR (split_part(name, '/', 1))::uuid = public.current_artist_id()
    )
  );
