# Reativar Maciel Tattoo

O Maciel já está cadastrado, mas desativado. Vamos apenas reativá-lo, sem mudar mais nada.

## O que muda
- Maciel Tattoo volta a aparecer na Agenda, no Totem, nos agendamentos e nos relatórios.
- Calendário (BMolaQM8M3kQDiKxFNxZ) e usuário do CRM (MmNZUW7IedFpLJ3SYNLQ) ficam como estão.
- Nada é alterado no CRM, sem importação, publicação ou migração.

## Detalhes técnicos
- Uma única alteração de dados: `UPDATE public.artists SET active = true WHERE id = 'e68ceab0-1989-4448-86a3-855b0e83bbbb';`
- Conferir depois com leitura da tabela `artists` que o registro está ativo.
- Comissão, e-mail e vínculo de login não mudam; se o Maciel precisar entrar no app, o acesso dele é configurado à parte.
