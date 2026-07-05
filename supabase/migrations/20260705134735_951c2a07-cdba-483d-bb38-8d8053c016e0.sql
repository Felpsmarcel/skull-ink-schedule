ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'seller';

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS seller_id uuid NULL REFERENCES public.sellers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_seller_id_unique
  ON public.app_users(seller_id)
  WHERE seller_id IS NOT NULL;