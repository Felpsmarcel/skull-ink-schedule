CREATE OR REPLACE FUNCTION public.count_vinculos_incompletos()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_appt_sem_projeto int;
  v_appt_sem_opp int;
  v_mov_sem_vinculo int;
BEGIN
  IF public.current_user_role() <> 'admin'::user_role THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_appt_sem_projeto
    FROM public.appointments
   WHERE project_id IS NULL AND start_at >= now() - interval '90 days';

  SELECT count(*) INTO v_appt_sem_opp
    FROM public.appointments
   WHERE ghl_opportunity_id IS NULL AND start_at >= now() - interval '90 days';

  SELECT count(*) INTO v_mov_sem_vinculo
    FROM public.movimentacoes
   WHERE deleted_at IS NULL
     AND project_id IS NULL
     AND appointment_id IS NULL
     AND tipo_movimento IN ('sinal'::movimentacao_tipo, 'sessao'::movimentacao_tipo)
     AND data_pagamento >= (now() - interval '90 days')::date;

  RETURN jsonb_build_object(
    'appointmentsSemProjeto', v_appt_sem_projeto,
    'appointmentsSemOportunidade', v_appt_sem_opp,
    'movimentacoesSemVinculo', v_mov_sem_vinculo,
    'total', v_appt_sem_projeto + v_mov_sem_vinculo
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.count_vinculos_incompletos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_vinculos_incompletos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_vinculos_incompletos() TO service_role;