# Diagnóstico de lentidão — GF Tattoo

## O que foi medido (somente leitura)
- Banco saudável: memória 63%, disco 6%, 8 de 60 conexões, nenhum alerta de esgotamento em 48h. Aumentar o servidor **não** resolveria.
- A maior carga é a **sincronização com o GHL**: a atualização de agendamentos um a um foi executada 6.943 vezes, ~300 ms em média e picos de até 5,8 s (≈34 min de banco no total). Inserções de contatos também chegam a 5,4 s.
- Existem **3 rotinas de sincronização** agendadas a cada 10 min (`sync-ghl-appointments`, `gf-sync-ghl-appointments-10min`, `ghl-sync-10min`). Provavelmente se sobrepõem e disputam as mesmas linhas, o que explica os picos (hipótese a confirmar no passo 1).
- A sincronização regrava todos os ~1.000 agendamentos mesmo quando nada mudou.
- Índices duplicados em `appointments.ghl_appointment_id` (2) e `contacts.ghl_contact_id` (2): deixam cada gravação mais lenta.
- No app (Impeccable/Operate): Home recarrega a cada 60 s; Agenda e status a cada 120 s, em consultas separadas. É aceitável, mas soma carga enquanto a sincronização roda.

## Plano (precisa da sua aprovação antes de executar)
1. **Confirmar sobreposição**: ler o histórico de execução das 3 rotinas (horários, duração, falhas) e qual delas é a oficial. Só leitura.
2. **Manter uma única rotina de sincronização** e desligar as duplicadas (reversível; histórico preservado). Exige sua autorização explícita, pois mexe no agendamento da sincronização.
3. **Gravar só o que mudou**: comparar com o registro atual e pular agendamentos/contatos idênticos; agrupar gravações em lote. Mantém as proteções de identidade, idempotência e trava de execução.
4. **Remover os 2 índices duplicados** (mantendo os únicos).
5. **App**: unir as consultas de status/valores da Agenda à consulta do dia já existente quando possível, e pausar o refresh automático com a aba em segundo plano (já é feito) — sem mudar telas.
6. **Medir de novo** com as mesmas consultas lentas e o tempo de abertura da Agenda/Home em 393 e 1280 px.

## Limites
- Não altera GHL, IDs de calendário, pagamentos, comissões nem permissões.
- Nada é publicado sem sua aprovação.

## Detalhes técnicos
- Causa provável: contenção de bloqueios por crons concorrentes + UPDATEs sem mudança (cada um gera WAL e dispara `trg_appointments_updated_at`).
- Índices redundantes: `idx_appt_ghl` (coberto por `appointments_ghl_appointment_id_key`) e `idx_contacts_ghl` (coberto por `contacts_ghl_contact_id_key`).
- Arquivos previstos: `src/lib/sync.server.ts`, `src/lib/sync-core.ts`, uma migração para cron/índices, testes em `tests/unit/`.
