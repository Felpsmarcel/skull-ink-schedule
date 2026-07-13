
# Diagnóstico — Jornada do tatuador no iPhone

Nenhuma alteração de código. Análise focada apenas nas telas usadas pelo tatuador durante o dia (Agenda → detalhe do agendamento).

---

## Simulação da jornada

### 1) Entrar no aplicativo
**Funciona:** login guarda sessão; `/` redireciona para `/agenda`, então já cai direto no que importa.
**Dificulta:** nada relevante além do custo de teclado no login inicial.
**Toques:** 0 (sessão já ativa) · 3–4 (login com email/senha).
**Falta/sobra:** nada crítico.
**Ação escondida:** —
**Melhoria:** manter sessão longa (já faz) e priorizar botão Face ID/Apple no futuro.

---

### 2) Ver os atendimentos de hoje
**Funciona:** agenda abre no dia corrente; KPI "sessões / livres" no topo; indicador "agora" na grade; auto-refetch a cada 2 min.
**Dificulta:**
- **Botão "Hoje" invisível no mobile** — está `hidden ... sm:inline-flex` (`agenda.tsx` L219–225). Para voltar de outro dia é preciso abrir o popover do calendário e escolher. Custo alto com uma mão.
- **Sem toggle "Minha agenda / Todos"** — o código força `restrictArtistId = null` (L116) com o comentário "Tatuadores veem a agenda geral". O filtro por artista existe apenas como *chips horizontais* no mobile (L409–440). O tatuador precisa rolar/clicar a própria inicial toda vez que abre; não há persistência da última seleção.
- **Header muito alto no iPhone** — safe-area + linha de data + linha de tabs (Dia/Semana/Mês) + KPI ribbon + chips de artista = ~4 faixas empilhadas antes da primeira linha da grade. Em iPhone padrão sobra pouca grade visível.
- **Grade horaria começa em `DEFAULT_START_HOUR`** — se o primeiro atendimento é às 14h, o tatuador ainda tem que rolar por horas vazias da manhã.
- **Coluna de horas de 40px no mobile (`w-10`)** com fonte 9px — legível, mas no limite.
**Toques para "ver hoje" vindo de outro dia:** 3 (abrir popover → mês → dia). Deveria ser 1.
**Falta:** botão "Hoje" persistente no header mobile; "pular para próximo atendimento"; memória do último artista selecionado.
**Sobra:** tabs "Semana/Mês" ocupando linha inteira mesmo quando o tatuador só usa "Dia" no trabalho.
**Melhoria recomendada:** mover "Hoje" para o header mobile (ao lado das setas ou como pílula à direita) e persistir seleção de artista em localStorage.

---

### 3) Abrir um agendamento
**Funciona:** tocar em qualquer slot ocupado abre `AgendaAppointmentSheet` (bottom sheet no mobile). Alvo de toque = altura da linha (56px) × largura da coluna — adequado.
**Dificulta:**
- Se duas colunas de artistas estão visíveis simultaneamente e há sobreposição de eventos (`hasOverlap`), o toque pode cair no slot errado.
- Nenhuma indicação visual de "próximo atendimento" na grade (ex.: borda pulsante). O tatuador precisa cruzar o "now line" com os cards.
**Toques:** 1.
**Melhoria:** destacar o próximo atendimento do dia com contraste (badge "PRÓXIMO").

---

### 4) Consultar cliente, horário, projeto, valores, sinal, observações e fotos
Referência: `src/components/agenda-appointment-sheet.tsx`.

**Funciona:**
- Cliente (telefone/e-mail) com atalhos `tel:`/`mailto:` e copiar — excelente para uso com uma mão.
- Bloco "Financeiro" mostra sinal (`depositEur`), saldo restante e histórico de pagamentos.
- Bloco de duração e horário no cabeçalho.
- Troca de artista via `ArtistPicker`.

**Dificulta / faltas graves:**
- **Sem "projeto"/descrição do trabalho** — só aparece `serviceName`. Não há campo para referência visual, descrição do desenho, tamanho, região do corpo.
- **Sem "observações"** exibidas — o `notes` é gravado ao criar o agendamento e ao criar pagamento, mas **não é lido/exibido** no sheet do dia. O tatuador não consegue rever o briefing.
- **Sem fotos/referências** — não há upload nem visualização de imagens do projeto. É a maior lacuna funcional para o dia de trabalho.
- **Status atual apenas como texto cru** (`Row label="Status" value={slot.appointmentStatus}` L177–179) — sem StatusBadge, sem cores, sem tradução PT.
- **Rolagem interna do sheet** já é longa (contato + finanças + histórico), colocar fotos exigirá cuidado com hierarquia.
**Toques para "ver observações":** ∞ (não existe).
**Melhoria:** adicionar 3 blocos no sheet — *Projeto* (descrição + região + tamanho), *Referências* (grid de fotos, tap para lightbox), *Observações* (texto livre). Priorizar antes de Financeiro na ordem visual.

---

### 5) Atualizar o status do atendimento
**Funciona:** existe a mutação `setStatus` (bucket `pago | pendente | a_receber`), mas ela é chamada apenas via fluxo de pagamento.
**Dificulta:**
- **Não existe controle direto** de status do atendimento (agendado → em andamento → concluído → no-show → cancelado). O `slot.appointmentStatus` é apenas leitura.
- O que hoje muda é o *bucket financeiro*, e mesmo esse controle está escondido dentro do `FinanceSection`, sem um botão claro "Marcar como pago".
- Nenhum atalho "Cheguei / Iniciar / Encerrar" — comum em apps de agenda usados durante a sessão.
**Toques para mudar status operacional:** impossível sem passar por criar pagamento.
**Melhoria:** adicionar um seletor de status operacional no topo do sheet (chips: Confirmado · Em andamento · Concluído · No-show · Cancelado) chamando o server function correspondente.

---

### 6) Finalizar o atendimento
**Funciona:** o fluxo de "finalizar" existe implicitamente ao registrar o **pagamento final** — `PaymentForm` com `type: "final"` e `status: "paid"` (L752, 798). Isso invalida agenda e finanças.
**Dificulta:**
- Não há um botão único "**Finalizar atendimento**" que:
  1) marque como concluído,
  2) abra o pagamento final pré-preenchido com o saldo restante,
  3) confirme e feche.
  Hoje o tatuador precisa: abrir sheet → rolar até Financeiro → "Adicionar pagamento" → escolher tipo `final` → preencher valor → status `paid` → salvar. **6–7 toques + digitação.**
- Valor **não vem pré-preenchido** com o saldo restante mostrado logo acima ("Saldo restante").
- Método de pagamento e observação são opcionais, mas o formulário não sinaliza isso claramente.
- Sem confirmação háptica/visual de "atendimento encerrado".
**Toques:** 6–7 (deveriam ser 2: "Finalizar" → "Confirmar").
**Melhoria:** botão fixo no rodapé do sheet **"Finalizar atendimento"** que abre o `PaymentForm` já preenchido com saldo restante e `type: "final"`, `status: "paid"`.

---

## Considerações transversais

- **Uso com uma mão:** BottomNav e `WizardFooter` estão bem posicionados (área do polegar). O header da agenda, porém, concentra ações críticas (data, navegação, tabs) no topo — longe do polegar no iPhone Pro Max.
- **Legibilidade:** fontes 9–11px em coluna de horas e KPI ribbon estão no limite mínimo iOS. Adequadas mas frágeis em modo Zoom do iOS.
- **Rolagem desnecessária:** grade começa às `DEFAULT_START_HOUR` mesmo sem eventos até tarde; sheet não abre ancorado no primeiro conteúdo útil.
- **Fotos e referências:** ausentes em todo o app.
- **Toaster** duplicado no arquivo `agenda.tsx` (L161) — em cima do global.

---

## As 5 maiores dificuldades do tatuador

1. **Ausência de fotos/referências e observações** no detalhe do agendamento — impossível revisar o briefing durante o atendimento.
2. **Sem "Finalizar atendimento" em um toque** — hoje custa 6–7 toques via fluxo financeiro.
3. **Sem controle direto de status operacional** (só bucket financeiro).
4. **Botão "Hoje" invisível no mobile** — voltar ao dia atual exige 3 toques no calendário.
5. **Sem seleção persistente "Minha agenda / Todos"** — chips de artistas resetam e obrigam a re-selecionar toda hora.

## As 5 melhorias de maior impacto

1. **Blocos "Projeto / Referências / Observações"** no `AgendaAppointmentSheet`, incluindo upload e lightbox de fotos.
2. **Botão "Finalizar atendimento"** fixo no rodapé do sheet, pré-preenchido com saldo restante e status `paid`.
3. **Seletor de status operacional** (chips Confirmado / Em andamento / Concluído / No-show / Cancelado) no topo do sheet.
4. **Toggle "Minha agenda / Todos" persistente** (default = "Minha" para role artist) com memória em localStorage.
5. **Header mobile enxuto**: pílula "Hoje" sempre visível, tabs Dia/Semana/Mês recolhidas em menu, KPI ribbon opcional.

## Quick wins (sem mudar regra de negócio)

- Tornar o botão **"Hoje" visível no mobile** (remover `hidden sm:inline-flex` do L222).
- Trocar o texto cru de status (L178) por **`<StatusBadge>`** já usado no header.
- **Exibir `notes` do agendamento** no sheet (dado já persistido pelo `finalizeAppointment`, basta ler).
- **Pré-preencher `amountEur`** no `PaymentForm` com o saldo restante já calculado no bloco acima.
- **Persistir a última seleção de artista** dos chips do dia em `localStorage`.
- **Auto-rolar a grade** para a hora do primeiro evento (ou "agora") ao abrir a agenda no dia.
- **Remover Toaster duplicado** em `agenda.tsx` L161 (já existe global).
- Exibir uma **badge "PRÓXIMO"** no card do próximo atendimento do dia.
- Nas tabs Dia/Semana/Mês do mobile, esconder Semana/Mês atrás de um menu — libera altura útil.
- Aumentar levemente a coluna de horas no mobile (`w-10` → `w-12`) para 10–11px de fonte.

---

*Diagnóstico entregue. Nenhum arquivo foi modificado. Aguardando priorização para transformar quick wins e melhorias em plano de implementação.*
