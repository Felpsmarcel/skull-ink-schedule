# Testes E2E do fluxo do totem

Objetivo: cobrir automaticamente o caminho crítico do check-in, do totem até a página segura do cliente, e confirmar que a fila da equipa reflete a chegada imediatamente.

## O que os testes vão verificar

1. **Novo cliente (sem agendamento)**
   - `/totem` → "Sou um novo cliente" → nome + telefone → confirmação.
   - Marcar o consentimento de WhatsApp/SMS e confirmar chegada.
   - `/totem/pronto` mostra o código do atendimento (GF-xxx) e o QR Code renderizado.
   - Extrair o token da URL do QR e abrir `/a/{token}`: mostra o mesmo código, estado "Aguardando atendimento" e **nenhum dado pessoal** (nome/telefone não aparecem na página).

2. **Cliente com agendamento de hoje**
   - Registo de um contacto + agendamento de teste na base de dados antes do teste.
   - `/totem` → "Tenho agendamento" → pesquisa por nome → resultado aparece **mascarado** → validação pelos 4 últimos dígitos do telefone.
   - Confirmação mostra horário e tatuador; confirmar chegada gera código e QR.

3. **Atualização imediata na Home da equipa**
   - Sessão autenticada da equipa em `/home`.
   - O cliente que acabou de fazer check-in aparece na lista "Clientes aguardando" com o código correto.
   - Ação **Iniciar** muda o estado para "Em atendimento"; recarregar `/a/{token}` mostra o novo estado.
   - Ação **Concluir** remove o cliente da fila ativa.

4. **Consentimento sem marcação**
   - Confirmar chegada sem marcar o consentimento também funciona, e o registo fica sem consentimento (nenhum envio agendado).

## Detalhes técnicos

- Runner: **@playwright/test** como dependência de desenvolvimento, config em `playwright.config.ts` apontando para `http://localhost:8080`, projeto mobile (viewport 430x932) para refletir o uso real do totem.
- Testes em `tests/e2e/`:
  - `totem-novo-cliente.spec.ts`
  - `totem-agendado.spec.ts`
  - `totem-fila-home.spec.ts`
- Fixtures em `tests/e2e/fixtures/`:
  - `db.ts` — cliente com service role para criar contacto/agendamento de teste e apagar tudo o que o teste criou (contactos, agendamentos, check-ins) no `afterAll`. Todos os registos usam um prefixo `E2E-` no nome para serem identificáveis e nunca colidirem com dados reais.
  - `auth.ts` — restaura a sessão da equipa a partir das variáveis de ambiente de sessão já disponíveis no ambiente de testes, para os testes de `/home`.
- Seletores estáveis: usar textos/roles já presentes nos ecrãs; onde não houver âncora fiável (cartão da fila, badge de código, imagem do QR), adiciono `data-testid` mínimos nos componentes existentes — sem mudar layout nem comportamento.
- Scripts no `package.json`: `test:e2e` (headless) e `test:e2e:ui`.
- Os testes não fazem chamadas ao CRM: a sincronização já é assíncrona e tolerante a falhas, portanto os testes verificam apenas o estado na aplicação/base de dados e ignoram o `syncStatus`.

## Fora de escopo

- Testar o envio real de WhatsApp/SMS ou o workflow do CRM.
- Testes de captura de foto ou impressão (não existem no fluxo).
