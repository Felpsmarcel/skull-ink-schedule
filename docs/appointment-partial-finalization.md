# Finalização parcial de agendamentos

O wizard cria as sessões sequencialmente. Se uma sessão adicional retornar conflito de contato, falhar ou não tiver um projeto confirmado, as sessões anteriores podem já existir no GHL e no banco local. O aplicativo não desfaz esses registros e não informa conclusão integral.

O rascunho mantém um `bookingCheckpoint` no mesmo armazenamento de sessão já usado pelo wizard. Cada resposta confirmada preserva número da sessão, data, ID local, EventID, ProjectID, OpportunityID e chave de idempotência. O motivo da interrupção e a sessão pendente também ficam registrados. Uma resposta com erro não prova que nenhum registro foi criado; ela permanece pendente de conferência.

A revisão exibe o aviso de finalização parcial e impede novo envio desse rascunho. A aplicação não tenta novamente automaticamente, não limpa o rascunho e não envia as notificações finais de conclusão. Um recarregamento na mesma sessão conserva o checkpoint. Ele não substitui o histórico persistido de `booking_operations` e não é um registro durável entre dispositivos.

## Conferência administrativa

1. Usar os IDs confirmados e as chaves `appt-<rascunho>` / `appt-<rascunho>-sN` para conferir cada sessão no banco e no GHL.
2. Para a sessão pendente, verificar `booking_operations` e eventual EventID antes de criar qualquer lançamento. Um timeout pode ocorrer após a criação remota.
3. Conferir separadamente o vínculo do projeto, as datas e o sinal. O retorno de erro do pagamento não invalida um agendamento já criado.
4. Resolver apenas o registro pendente após confirmar sua situação. Não reiniciar o cadastro completo nem apagar as sessões confirmadas para repetir o processo.

Não há comando automático de desbloqueio ou de retomada parcial nesta alteração. Uma retomada futura precisa reconciliar os registros persistidos e validar novamente as sessões restantes. As chaves existentes foram mantidas e nenhum rollback do GHL foi introduzido.
