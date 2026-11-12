-- REVIEW-ONLY. NÃO APLICAR no banco real sem aprovação explícita do proprietário.
-- Persistência do rascunho administrativo de distribuição por sessão e dos vínculos
-- projeto ↔ oportunidade GHL. Testado apenas em PGlite efêmero (tests/unit/project-allocation-sql.test.ts).
-- Rascunho aprovado NÃO é recebimento, comissão apurada nem repasse.

-- 1. Rascunho versionado (um por projeto). version protege contra abas concorrentes.
CREATE TABLE public.project_allocation_drafts (
  project_id uuid PRIMARY KEY REFERENCES public.tattoo_projects(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  contract_cents_snapshot bigint,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_allocation_lines (
  project_id uuid NOT NULL REFERENCES public.project_allocation_drafts(project_id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  frozen_at timestamptz,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, appointment_id)
);
-- Trilha imutável: autor + data + versão de cada gravação.
CREATE TABLE public.project_allocation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL,
  version integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  lines jsonb NOT NULL,
  actor uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Vínculos projeto ↔ oportunidade (vários por projeto; sem soma imposta).
CREATE TABLE public.project_opportunity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id) ON DELETE RESTRICT,
  ghl_opportunity_id text NOT NULL UNIQUE,      -- uma oportunidade nunca pertence a dois projetos
  ghl_contact_id text NOT NULL,
  link_kind text NOT NULL CHECK (link_kind IN ('active','historical')),
  status_at_link text NOT NULL,
  value_cents_at_link bigint,
  contract_decision text CHECK (contract_decision IN ('keep_contract')),
  idempotency_key text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.project_allocation_drafts, public.project_allocation_lines,
  public.project_allocation_audit, public.project_opportunity_links TO authenticated;
GRANT ALL ON public.project_allocation_drafts, public.project_allocation_lines,
  public.project_allocation_audit, public.project_opportunity_links TO service_role;
ALTER TABLE public.project_allocation_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_allocation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_allocation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_opportunity_links ENABLE ROW LEVEL SECURITY;
-- Somente leitura admin; escrita exclusivamente pelas RPCs abaixo (sem INSERT/UPDATE direto).
CREATE POLICY pad_admin_read ON public.project_allocation_drafts FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY pal_admin_read ON public.project_allocation_lines FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY paa_admin_read ON public.project_allocation_audit FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY pol_admin_read ON public.project_opportunity_links FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

-- 3. Gravação atômica do rascunho. p_lines = [{"appointment_id": uuid, "amount_cents": int}, ...]
-- Erros: forbidden | project_not_found | version_conflict | invalid_line | foreign_session |
--        cancelled_session | frozen_line | exceeds_contract | contract_unknown
CREATE OR REPLACE FUNCTION public.save_project_allocation_draft(
  p_project_id uuid, p_expected_version integer, p_idempotency_key text, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contract bigint;
  v_version integer;
  v_prev jsonb;
  v_sum bigint := 0;
  r record;
BEGIN
  IF v_uid IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 16 THEN RAISE EXCEPTION 'invalid_line'; END IF;
  -- Dupla submissão: mesma chave devolve o resultado original sem nova versão.
  SELECT jsonb_build_object('version', a.version, 'replayed', true) INTO v_prev
    FROM project_allocation_audit a WHERE a.idempotency_key = p_idempotency_key AND a.project_id = p_project_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev; END IF;

  SELECT round(quoted_total_eur * 100)::bigint INTO v_contract
    FROM tattoo_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_contract IS NULL OR v_contract <= 0 THEN RAISE EXCEPTION 'contract_unknown'; END IF;

  INSERT INTO project_allocation_drafts(project_id, version, updated_by)
    VALUES (p_project_id, 0, v_uid) ON CONFLICT (project_id) DO NOTHING;
  SELECT version INTO v_version FROM project_allocation_drafts WHERE project_id = p_project_id FOR UPDATE;
  IF v_version <> p_expected_version THEN RAISE EXCEPTION 'version_conflict'; END IF;

  IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'invalid_line'; END IF;
  FOR r IN SELECT (e->>'appointment_id')::uuid AS aid, e->'amount_cents' AS amt
           FROM jsonb_array_elements(p_lines) e LOOP
    IF r.aid IS NULL OR jsonb_typeof(r.amt) <> 'number' OR (r.amt)::numeric <> trunc((r.amt)::numeric)
       OR (r.amt)::numeric < 0 THEN RAISE EXCEPTION 'invalid_line'; END IF;
    PERFORM 1 FROM appointments WHERE id = r.aid AND project_id = p_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'foreign_session'; END IF;
    PERFORM 1 FROM appointments WHERE id = r.aid AND status::text = 'cancelled';
    IF FOUND THEN RAISE EXCEPTION 'cancelled_session'; END IF;
    PERFORM 1 FROM project_allocation_lines
      WHERE project_id = p_project_id AND appointment_id = r.aid AND frozen_at IS NOT NULL
        AND amount_cents <> (r.amt)::bigint;
    IF FOUND THEN RAISE EXCEPTION 'frozen_line'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(p_lines)) <>
     (SELECT count(DISTINCT e->>'appointment_id') FROM jsonb_array_elements(p_lines) e) THEN
    RAISE EXCEPTION 'invalid_line';
  END IF;
  -- Linhas congeladas omitidas do payload continuam valendo (nunca removidas).
  PERFORM 1 FROM project_allocation_lines l WHERE l.project_id = p_project_id AND l.frozen_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) e WHERE (e->>'appointment_id')::uuid = l.appointment_id);
  IF FOUND THEN RAISE EXCEPTION 'frozen_line'; END IF;

  SELECT coalesce(sum((e->>'amount_cents')::bigint), 0) INTO v_sum FROM jsonb_array_elements(p_lines) e;
  IF v_sum > v_contract THEN RAISE EXCEPTION 'exceeds_contract'; END IF;

  DELETE FROM project_allocation_lines WHERE project_id = p_project_id AND frozen_at IS NULL;
  INSERT INTO project_allocation_lines(project_id, appointment_id, amount_cents, updated_by)
    SELECT p_project_id, (e->>'appointment_id')::uuid, (e->>'amount_cents')::bigint, v_uid
    FROM jsonb_array_elements(p_lines) e
    ON CONFLICT (project_id, appointment_id) DO NOTHING;  -- congeladas permanecem
  UPDATE project_allocation_drafts SET version = version + 1, contract_cents_snapshot = v_contract,
    updated_by = v_uid, updated_at = now() WHERE project_id = p_project_id
    RETURNING version INTO v_version;
  INSERT INTO project_allocation_audit(project_id, version, idempotency_key, lines, actor)
    VALUES (p_project_id, v_version, p_idempotency_key, p_lines, v_uid);
  RETURN jsonb_build_object('version', v_version, 'replayed', false);
END $$;

-- 4. Vínculo de oportunidade. Valores/status chegam do servidor APÓS releitura GHL completa;
-- RPC exclusiva service_role: navegador não pode fornecer snapshots GHL diretamente.
-- p_actor vem da identidade autenticada verificada no servidor, nunca do payload do navegador.
-- A RPC revalida papel admin, contato, unicidade e divergência. Nunca altera o contrato.
-- Erros: forbidden | project_not_found | contact_mismatch | linked_elsewhere | decision_required
CREATE OR REPLACE FUNCTION public.link_project_opportunity(
  p_project_id uuid, p_opportunity_id text, p_contact_id text, p_status text,
  p_value_cents bigint, p_contract_decision text, p_idempotency_key text, p_actor uuid, p_expected_contract_cents bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := p_actor;
  v_contact text;
  v_contract bigint;
  v_kind text;
  v_existing record;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = v_uid AND role::text = 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status IS NULL OR lower(p_status) NOT IN ('open','won','lost','abandoned') OR p_value_cents < 0
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) < 16 THEN RAISE EXCEPTION 'invalid_line'; END IF;
  SELECT ghl_contact_id, round(quoted_total_eur * 100)::bigint INTO v_contact, v_contract
    FROM tattoo_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_contact IS NULL OR v_contact <> p_contact_id THEN RAISE EXCEPTION 'contact_mismatch'; END IF;

  SELECT * INTO v_existing FROM project_opportunity_links WHERE ghl_opportunity_id = p_opportunity_id;
  IF FOUND THEN
    IF v_existing.project_id <> p_project_id THEN RAISE EXCEPTION 'linked_elsewhere'; END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'replayed', true, 'kind', v_existing.link_kind);
  END IF;
  PERFORM 1 FROM tattoo_projects WHERE ghl_opportunity_id = p_opportunity_id AND id <> p_project_id;
  IF FOUND THEN RAISE EXCEPTION 'linked_elsewhere'; END IF;

  IF v_contract IS DISTINCT FROM p_expected_contract_cents THEN RAISE EXCEPTION 'contract_changed'; END IF;

  v_kind := CASE WHEN lower(p_status) IN ('lost','abandoned') THEN 'historical' ELSE 'active' END;
  IF v_kind = 'active' AND (p_value_cents IS NULL OR v_contract IS NULL OR p_value_cents <> v_contract)
     AND p_contract_decision IS DISTINCT FROM 'keep_contract' THEN
    RAISE EXCEPTION 'decision_required';
  END IF;
  INSERT INTO project_opportunity_links(project_id, ghl_opportunity_id, ghl_contact_id, link_kind,
      status_at_link, value_cents_at_link, contract_decision, idempotency_key, created_by)
    VALUES (p_project_id, p_opportunity_id, p_contact_id, v_kind, p_status, p_value_cents,
      CASE WHEN v_kind = 'active' THEN p_contract_decision END, p_idempotency_key, v_uid)
    RETURNING jsonb_build_object('id', id, 'replayed', false, 'kind', link_kind) INTO v_out;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.save_project_allocation_draft(uuid, integer, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_project_opportunity(uuid, text, text, text, bigint, text, text, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_project_allocation_draft(uuid, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_project_opportunity(uuid, text, text, text, bigint, text, text, uuid, bigint) TO service_role;
