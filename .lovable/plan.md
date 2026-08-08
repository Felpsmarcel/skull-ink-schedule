# Check-in no Totem — escopo corrigido (Fase 1)

Escopo revisado conforme pedido: **sem foto, sem impressão térmica, QR Code apenas digital**. A arquitetura fica preparada para a foto no futuro, mas nada aparece ao cliente e nada bloqueia o check-in.

## Removido do fluxo inicial

- Pedido de autorização de foto, câmera, contagem regressiva e captura automática.
- Obrigatoriedade de `photo_url` e `photo_consent`.
- Qualquer impressão de senha ou QR em papel.

As colunas de foto ficam criadas e opcionais (nulas), sem UI. A captura futura será acionada pela equipe durante o atendimento, não pelo cliente.

## Fluxo do totem (o que o cliente vê)

1. Boas-vindas (tela cheia, sem menus, sem login).
2. "Tenho agendamento" ou "Sou novo cliente".
3. Busca por nome ou telefone.
4. Validação do telefone (confirmação dos últimos dígitos).
5. Sistema localiza ou cria o contato.
6. Sistema localiza o agendamento do dia e a oportunidade.
7. Confirmação dos dados do atendimento (horário, tatuador).
8. Botão "Confirmar minha chegada".
9. Registro do check-in + atualização no CRM.
10. QR Code digital na tela, para o cliente ler com o próprio celular.
11. Cliente entra na fila interna e aparece na Home da equipe em "Clientes aguardando".
12. Equipe inicia o atendimento pela Home.

## Rotas

Públicas (sem login, tela de totem e página do cliente):

- `/totem` — boas-vindas.
- `/totem/buscar` — busca e validação de telefone.
- `/totem/confirmar` — confirmação dos dados + "Confirmar minha chegada".
- `/totem/pronto` — exibe o QR Code digital e o código do atendimento.
- `/a/$token` — página segura do atendimento, aberta ao escanear o QR.

Internas (área autenticada):

- `/home` — seção "Clientes aguardando" com a fila do dia e ação "Iniciar atendimento".
- `/admin/fila` — visão administrativa da fila, com histórico do dia.

Servidor:

- `src/lib/checkin.functions.ts` — buscar contato, validar telefone, criar check-in, ler status por token, avançar status.
- `src/lib/checkin-ghl.server.ts` — toda a conversa com o CRM (contato, agendamento, oportunidade, tag, campos, workflow).
- `src/routes/api/public/hooks/checkin-status.ts` — webhook opcional para o CRM devolver mudanças de status.

A página `/a/$token` e o totem leem dados por funções seguras no banco (security definer), nunca com acesso direto de leitura pública às tabelas.

## Tabela nova: `checkins`

Campos de identificação e vínculo:

- `id`, `created_at`, `updated_at`
- `contact_id` (contato local), `ghl_contact_id`
- `appointment_id` (quando existir), `ghl_appointment_id`
- `ghl_opportunity_id`
- `artist_id` (tatuador responsável, quando conhecido)
- `codigo_atendimento` — código curto legível, ex. `GF-042`, reiniciado por dia

Estado e horários:

- `status` — `aguardando`, `em_atendimento`, `concluido`, `nao_compareceu`, `cancelado`
- `arrived_at`, `started_at`, `finished_at`
- `scheduled_at` (horário agendado, copiado no momento do check-in)
- `source` — padrão `Totem GF`

QR Code:

- `qr_token` — token aleatório e único, sem dado pessoal
- `qr_url`
- `qr_created_at`, `qr_expires_at` (expira no fim do dia)

Comunicação e futuro:

- `consentimento_comunicacao` (booleano) e `notificado_em`
- `photo_url`, `photo_consent`, `photo_taken_at` — todos nulos e sem UI nesta fase

Regras de acesso:

- Equipe autenticada vê e atualiza a fila; admin vê tudo.
- O público não lê a tabela diretamente. A página `/a/$token` usa uma função segura que recebe o token e devolve **apenas** código do atendimento, status, horário agendado, primeiro nome do tatuador e aviso de que a equipe foi notificada — sem telefone, e-mail ou nome completo do cliente.
- Um índice único evita dois check-ins ativos para o mesmo contato no mesmo dia (anti-duplicidade).

## O QR Code

- Contém apenas `https://www.gftattoocalendar.com/a/<token>`. Nenhum nome, telefone ou identificador do CRM.
- Token aleatório longo, de uso único por atendimento, com validade até o fim do dia.
- Gerado no servidor no momento do check-in; a imagem é desenhada na própria tela do totem.
- O mesmo link é enviado por WhatsApp ou SMS **somente** quando existir consentimento de comunicação registrado.

## Integração com o HighLevel

No momento em que o cliente confirma a chegada, o servidor executa, em ordem, com tolerância a falha parcial:

1. Localizar o contato por telefone; criar apenas se não existir (evita duplicados).
2. Localizar o agendamento do dia desse contato.
3. Localizar a oportunidade correspondente; reutilizar a existente em vez de criar outra.
4. Aplicar a tag `check-in-totem-gf`.
5. Atualizar o campo de status para **Aguardando atendimento**.
6. Salvar o código e a URL digital do atendimento no contato/oportunidade.
7. Acionar o workflow de confirmação.
8. Gravar tudo em `checkins` para a fila interna aparecer na hora.

Se o CRM falhar, o check-in **não** é perdido: fica gravado localmente com estado de sincronização pendente e é reprocessado, igual ao que já existe hoje para os lançamentos financeiros. O cliente vê o QR normalmente.

### Campos personalizados necessários no CRM

- `checkin_status` — texto/lista: Aguardando atendimento, Em atendimento, Concluído
- `checkin_codigo` — código do atendimento
- `checkin_url` — link digital do atendimento
- `checkin_arrived_at` — data e hora da chegada
- `checkin_source` — origem (Totem GF)

### Tag

- `check-in-totem-gf`

### Workflows

- **Confirmação de chegada** — disparado pela tag; envia ao cliente a confirmação com o link do atendimento (WhatsApp/SMS conforme consentimento) e notifica a equipe.
- **Aviso à equipe** — notificação interna de novo cliente aguardando.
- (Opcional, fase seguinte) **Sem atendimento em X minutos** — alerta se alguém ficar muito tempo na fila.

## Avaliação técnica revisada

Impacto: **MÉDIO** (antes seria ALTO por causa da câmera, consentimento de imagem, armazenamento de fotos e impressão).

Com o escopo cortado, o que resta é: uma tabela, um conjunto de rotas novas, a página do QR e a sequência de chamadas ao CRM. Nada da agenda, financeiro ou autenticação existente muda. As duas partes que exigem cuidado real são a **anti-duplicidade no CRM** e a **fila do dia na Home** — o resto é trabalho direto.

O que já existe e será reaproveitado: acesso ao CRM (contatos, agendamentos, busca por telefone), o padrão de sincronização com estado pendente e reprocessamento, funções seguras de leitura pública (já usadas no histórico de pagamentos) e a seção "Clientes aguardando" prevista na Home.

Fora desta fase, propositalmente: captura de foto, impressão térmica, senha em papel, autoatendimento de pagamento no totem.

## Ordem de implementação

1. Tabela `checkins` + funções seguras de leitura por token.
2. Fluxo do totem até o registro local do check-in (já funcional sem o CRM).
3. QR digital + página `/a/$token`.
4. Integração com o CRM (contato, agendamento, oportunidade, tag, campos, workflow) com fila de reprocessamento.
5. "Clientes aguardando" na Home + ação "Iniciar atendimento".
6. Envio do link por WhatsApp/SMS quando houver consentimento.
