## Diagnóstico visual da Agenda atual

Olhando o screenshot de sábado 04/07, vejo problemas concretos que fazem o dashboard parecer "planilha crua" em vez de produto:

**1. Ruído visual dominante**
- Cada slot livre repete "SEM RESERVA" em caixa tracejada. Em um dia com 7 tatuadores × 20 slots isso são ~140 rótulos idênticos gritando na tela.
- O olho não consegue achar o que importa (os agendamentos reais).

**2. Header sem hierarquia**
- Skull + setas + "SÁBADO, 04/07/2026" + "HOJE" competem pela mesma linha, sem âncora clara.
- Falta seletor Dia/Semana/Mês visível (existe no código mas não aparece bem).
- Contadores "0● 9○" ao lado do nome são crípticos — ninguém sabe se bola cheia é livre ou ocupado.

**3. Cards de evento fracos**
- Todos os "Reservado" têm o mesmo peso — não dá pra distinguir consulta rápida (30min) de tattoo de 5h.
- Badge "A RECEBER" fica solto no rodapé do card, às vezes fora dele.
- Sem cor por tatuador → 7 colunas viram um borrão preto-e-branco.
- Ícone ⚠️ aparece sem legenda.

**4. Densidade e escala**
- Slots de 30min fixos ocupam altura enorme. Um dia inteiro exige scroll longo mesmo em desktop 1248px.
- Colunas dos tatuadores têm larguras iguais, mesmo quando um deles não tem nada agendado (Andre, Joyce).

**5. Falta de contexto de negócio**
- Não há barra de KPIs do dia (ex: "6 agendamentos • €480 previsto • 2 a receber").
- Sem indicação visual de "agora" (linha do horário atual).
- Sem filtro rápido por tatuador ou por status.

---

## Como eu proponho evoluir

Quero gerar **3 direções visuais renderizadas** que resolvem os 5 problemas acima, mantendo a identidade GF Tattoo (preto/branco, Archivo Black + Inter, skull mark). As 3 direções variariam em:

- **Direção A — "Studio Board"**: densidade tipo Linear/Notion Calendar. Slots livres viram fundo neutro sutil (sem rótulo), só eventos têm card. Header consolidado com KPIs do dia. Linha do "agora" viva.
- **Direção B — "Print de Estúdio"**: editorial monocromático, tipografia grande Archivo Black nos horários âncora (08, 12, 18), colunas com iniciais grandes dos tatuadores no topo, cards de evento com hairline preta e valor em destaque.
- **Direção C — "Command Center"**: mais denso, escala vertical comprimida (30min = ~32px), coluna esquerda com timeline, chips coloridos por serviço, filtros no topo (tatuador, status, período), badge "A RECEBER" virando pill amarela consistente.

Todas mantêm: paleta B/W, fontes atuais, layout mobile-friendly, dados reais do GHL, sem quebrar rotas ou hooks (`use-agenda`, `useStaffDayAgenda`, `agenda-grid.ts`).

---

## Próximo passo (o que vai acontecer se aprovar)

1. Capturo a tela `/agenda` em desktop e mobile via Playwright para servir de referência visual às direções.
2. Rodo `design--create_directions` com as 3 direções acima usando o screenshot que você já enviou + a captura live.
3. Te apresento as 3 prévias renderizadas lado a lado via `ask_questions` (type: prototype).
4. Você escolhe UMA — eu implemento só ela, sem mexer em lógica de negócio (fetch, GHL, comissão, checkout intocados).

Escopo estritamente frontend: `src/routes/_authenticated/agenda.tsx`, `src/lib/agenda-grid.ts` (só camada de apresentação/agrupamento visual), `src/components/agenda-appointment-sheet.tsx`, tokens em `src/styles.css`. Sem migrations, sem mudanças em server functions.
