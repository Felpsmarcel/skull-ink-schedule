-- Backfill: create contacts for existing appointments and link contact_id.
INSERT INTO public.contacts (ghl_contact_id, name, email, phone)
SELECT DISTINCT ON (a.ghl_contact_id)
  a.ghl_contact_id,
  COALESCE(NULLIF(a.contact_name, ''), 'Sem nome'),
  NULLIF(a.contact_email, ''),
  NULLIF(a.contact_phone, '')
FROM public.appointments a
WHERE a.ghl_contact_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.ghl_contact_id = a.ghl_contact_id)
ORDER BY a.ghl_contact_id, a.created_at DESC;

UPDATE public.appointments a
SET contact_id = c.id
FROM public.contacts c
WHERE c.ghl_contact_id = a.ghl_contact_id
  AND a.contact_id IS NULL;