-- Defesa em profundidade: o caminho oficial de criação passa pela server fn
-- createAppointmentRecord (SECURITY DEFINER via supabaseAdmin). A role
-- authenticated não deve poder inserir/deletar appointments diretamente.
REVOKE INSERT, DELETE ON public.appointments FROM authenticated;
-- UPDATE/SELECT continuam, mas RLS (appt_admin / appt_artist_update / appt_artist_select_blocked)
-- já restringe quem pode efetivamente ler ou alterar linhas.
