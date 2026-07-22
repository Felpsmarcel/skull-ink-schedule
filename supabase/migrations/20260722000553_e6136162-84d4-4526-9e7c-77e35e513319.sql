-- 1. Remove Felipe (duplicata vinculada por engano ao Augusto)
DELETE FROM public.app_users WHERE id = 'e963938e-da54-4aec-861c-3e3ac69dc364';

-- 2. Promove ffmconsultoria a admin master (mantém artist_id do Gabriel)
UPDATE public.app_users
SET role = 'admin'
WHERE id = '7cf2055b-0ee6-4dc9-95aa-6ec7b6b491a8';

-- 3. Desvincula as outras contas admin do artist_id do Gabriel
UPDATE public.app_users
SET artist_id = NULL
WHERE id IN (
  '2e8a0cee-67c5-48fe-8d49-efd306e74f60', -- contatodegabriel@gmail.com
  '2feb1be9-09b5-4916-93b5-61b0b8a510f6'  -- gabriel@gftattoo.test
);