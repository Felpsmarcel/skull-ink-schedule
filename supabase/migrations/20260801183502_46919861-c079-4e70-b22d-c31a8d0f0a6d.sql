DROP POLICY IF EXISTS "audit_select_authenticated" ON public.movimentacoes_audit;
CREATE POLICY "audit_select_admin" ON public.movimentacoes_audit
FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin'::user_role);