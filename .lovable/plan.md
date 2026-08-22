# Ligar o calendário do CRM ao Miguel Marquezine

Objetivo: o calendário `UofTIBSbarAnmOUhO56V` passa a ser o calendário do Miguel no CRM, para que os agendamentos dele apareçam automaticamente na Agenda.

## O que vai ser feito

1. **Ligar o calendário ao perfil dele**
   Gravar o ID `UofTIBSbarAnmOUhO56V` no registo do artista Miguel Marquezine (campo de calendário do CRM), confirmando antes que nenhum outro tatuador já usa esse mesmo ID (para não duplicar agendamentos entre agendas).

2. **Trazer os agendamentos existentes**
   Executar a sincronização com o CRM logo após ligar o calendário, para que os agendamentos já criados no CRM (últimos dias + próximos meses) apareçam na Agenda dele, com nome, telefone e email do cliente.

3. **Sincronização automática contínua**
   Nada novo a construir: o sync automático já corre de 10 em 10 minutos e percorre todos os tatuadores ativos com calendário preenchido — o Miguel entra automaticamente nesse ciclo. Só será verificado que o agendamento automático está de facto instalado e a correr sem erros.

4. **Verificação final**
   Conferir na Agenda que o Miguel aparece como coluna/filtro e que os agendamentos vindos do CRM estão lá, com a comissão de 40% aplicada.

## Detalhes técnicos

- Update em `public.artists.ghl_calendar_id` para o artista `3841eeda-0557-42cb-9fd7-21f335cc1c11`, após `SELECT` de conflito no mesmo `ghl_calendar_id`.
- Sync inicial via a função de sync já existente (`syncGhlAppointments` em `src/lib/sync.server.ts`), acionada pelo botão de sync do admin ou pelo endpoint público `/api/public/hooks/sync-ghl`. A função insere novos agendamentos e atualiza os existentes sem tocar em campos financeiros.
- Comissão: novos agendamentos herdam `commission_pct` do artista (40%).
- Cron: validar com `public.ghl_sync_status()` que o job `ghl-sync-10min` está ativo; se não estiver, instalar via a tela Menu → Equipe → Sync GHL.
- Sem alterações de schema e sem novas dependências.
