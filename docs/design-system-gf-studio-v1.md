# GF Tattoo Studio Manager — Design System Oficial v1

**Data:** 11/11/2026. **Entrega:** especificação documental; nenhuma aplicação no produto.
**Tela mestra e piloto principal:** Agenda Geral + Ficha do Agendamento, em Dia/Semana/Mês.
**Abrangência:** todas as áreas operacionais existentes, com identidade consistente derivada da Agenda.
**Direção recomendada, ainda não aprovada:** editorial operacional em grafite; alternativa clara comparada abaixo.
**Situação:** documento revisado; identidade definida como proposta, não implementada na UI real.

## 1. Escopo, evidência e método

Este documento define o padrão v1 solicitado, não autoriza alterações no aplicativo. Nenhum CSS, JS, dado, autenticação, API, GHL, workflow, permissão, cálculo ou publicação foi alterado. Não instala ferramentas. O único arquivo editado nesta revisão é este documento. A Agenda Geral é a matriz visual; nenhuma tela existente foi apagada ou perdeu funcionalidade.

### Impeccable efetivamente utilizado

Foi relido nesta revisão o arquivo realmente instalado `.workspace/skills/impeccable/SKILL.md`, incluindo **Start from the actual project**, **Universal design rules**, **Design action vocabulary**, **Working method** e **Mode-specific priorities**. O diretório instalado contém apenas `SKILL.md`: não há playbooks adicionais, CLI, hooks ou overlay disponíveis nessa instalação. Trata-se da adaptação Lovable Edition, baseada em Impeccable de Paul Bakaus e contribuidores, Apache-2.0; não se alegam funcionalidades do pacote upstream completo. A skill foi aplicada à definição e revisão do documento, **ainda não à interface real**.

O modo predominante é **Operate**: conferir o dia, localizar compromisso, entender continuidade e distinguir referência comercial de caixa. O padrão não transforma a operação em landing page.

| Ação Impeccable | Aplicação verificável neste documento |
|---|---|
| critique / audit | Inventário com caminhos e ocorrências concretas; separação entre leitura de código e verificação visual |
| distill / quieter | Reduzir caixa alta, contêineres aninhados, brilho e metadados competindo com cliente/data |
| typeset | Duas famílias, escala em px, números tabulares e limite mínimo de texto |
| adapt / layout | Anatomias próprias para 393px e 1280px, quebra de títulos e safe area |
| harden / clarify | Estados vazio, parcial, indisponível, sem acesso e fontes financeiras explicitamente distintas |
| hierarchy / polish | Agenda como tela mestra: data e escopo antes da grade; cliente/horário antes de metadados; alinhamento e densidade comuns às demais áreas |
| extract / document | Tokens semânticos, contratos visuais reutilizáveis e etapas de migração aprováveis |

**Limite da auditoria:** inspeção estática de código atual e cálculo das cores propostas. Não foi feita nova navegação autenticada, captura de tela, auditoria automatizada de acessibilidade, teste de teclado ou medição de desempenho nesta tarefa. O screenshot do login mencionado pelo proprietário é uma referência relatada, não uma imagem novamente inspecionada aqui. Não se conclui que todas as telas atualmente têm corte, contraste insuficiente ou erro visual. Critérios de QA abaixo são metas futuras, não testes já aprovados.

### Inventário atual e prioridade

| Prioridade | Arquivo / componente observado | Evidência atual | Consequência e decisão v1 |
|---|---|---|---|
| P0 | `src/styles.css` | Tailwind v4; `@theme inline`; cores OKLCH; `:root` já escuro; `.dark` só declara `color-scheme: dark` | Não existe hoje um tema claro completo. Especificar claro como alternativa futura, nunca tratá-lo como toggle pronto |
| P0 | `src/components/agenda-appointment-sheet.tsx` | Rótulos financeiros de 9px, seções de 10px, título `font-display uppercase tracking-wide` | Hierarquia difícil de ler pelo tamanho especificado; elevar texto e diferenciar eixos de estado |
| P0 | `src/routes/_authenticated/financeiro.tsx` | `FilterRow` usa Button `sm`; reconciliação 36×36; três métricas por linha; rótulos 10–11px | Padronizar alvo 44px, grid móvel e controles; não modificar filtros nem cálculo |
| P0 | `src/components/auth/auth-frame.tsx`, `src/routes/auth.tsx` | Logo h-20 (80px), cabeçalho py-7 (56px total), separador e h1 com mt-5; página py-10 (80px total), centralização vertical | Código comprova grande bloco anterior aos campos, não sua posição final em cada aparelho. Piloto deve reduzir distância logo→formulário sem mudar login |
| P1 | `src/components/ui/page-header.tsx` | H1 Space Mono 20/24px truncado; eyebrow uppercase; header sticky top-0 com blur | Permitir título em duas linhas; alinhar com header da estrutura desktop, sem sobreposição |
| P1 | `src/components/layout/auth-shell.tsx` | TopBar desktop 64px sticky; navegação uppercase com min-h-9; fundo translúcido/blur | Cabeçalho sólido e links 44px; preservar destinos e autorização |
| P1 | `src/components/layout/bottom-nav.tsx` | Links min-h-12; botão + 56px elevado, sombra dourada; safe area explícita | Manter safe area, destinos e alvos já adequados; reduzir efeito visual, não reorganizar navegação agora |
| P1 | `src/components/ui/section-label.tsx`, `stat-card.tsx`, `status-badge.tsx` | Caixa alta nos três; Space Mono em seções/métricas; badges de status em maiúsculas | Labels naturais, Rubik nos números e seções; reservar identidade editorial aos títulos |
| P1 | `src/routes/_authenticated/home.tsx`, `src/components/my-day.tsx` | Home max-w-md / sm:max-w-3xl; MyDay é seção aberta com resumo; outros blocos da Home usam cards e uppercase | Preservar Fase A e sua leitura por fontes; unificar a hierarquia sem fundir indicadores diferentes |
| P0 — matriz | `src/routes/_authenticated/agenda.tsx` | Header Cormorant 20/24px, grid de 56px, seletores 44px; semana/mês ainda têm 10–11px e tracking | Piloto principal em todas as visões, Todos e ficha; preservar gesto e fontes; matriz para todas as áreas |
| P1 | `src/routes/_authenticated/projetos.index.tsx` | Título editorial, filtros 44px, ProjectCard local, saldo admin com label genérico “Saldo” | Reutilizar continuidade e distinguir fonte do saldo; mudança semântica não deve mascarar cálculo existente |
| P1 | `src/routes/_authenticated/projetos.$projectId.tsx`, `src/components/project-commercial-summary.tsx` | Detalhe editorial; comercial e caixa já separados; sinal e caixa não são deduzidos conjuntamente | Manter a separação da Fase B/C e fortalecer títulos/fontes, sem novos recebimentos |
| P2 | `src/routes/_authenticated/painel-tatuador.tsx` | Títulos editoriais e listas abertas; acesso administrativo explícito | Área existente preservada; recebe padrão geral no conjunto das demais áreas, sem ser referência ou piloto |
| P2 | `src/routes/_authenticated/relatorios.movimentacoes.tsx` | PageHeader; filtros em card, Field uppercase; ações `sm`; mistura de 10–14px | Compactar por importância, garantir tamanho dos controles e conservar escopo das exportações |
| P2 | `src/routes/_authenticated/_admin/relatorios.agendamentos.tsx` | Título mono uppercase, filtros h-9, labels 10px; Table com overflow interno; botão HTML “Ver” | Padronizar componentes e labels; não afirmar overflow global sem teste |

Foram também lidos `src/components/ui/{button,input,select,tabs,sheet,table,empty-state,error-state,loading-state}.tsx`, `src/components/project-continuity.tsx` e `src/components/appointment-project-journey.tsx`. A leitura de `src/routes/__root.tsx` localizou o carregamento de Rubik e Space Mono; a Agenda carrega Cormorant no próprio head. A inspeção dos arquivos grandes foi concentrada nas áreas de apresentação e controles, não uma revisão de toda a lógica.

**Acertos a preservar:** tokens semânticos existentes; radius base 8px; Button padrão e icon 44px; Input/SelectTrigger 48px; safe area; reduced-motion global; texto financeiro tabular em muitos pontos; continuidade sem inferir abandono; MyDay separa agenda/check-in; resumo comercial separado do caixa.

**Anti-padrões observados no código:** três famílias concorrentes; excesso de uppercase; tracking amplo e alguns negativos; rótulos 9–11px; múltiplas sombras específicas e translucidez/blur; tamanhos 36/40/44/48px para controles com funções semelhantes; páginas com larguras e headers distintos. `sheet.tsx` usa overlay `bg-black/80`, saída 300ms/entrada 500ms e fechamento sem alvo explícito de 44px. `Input`/`Select` usam ring com opacidade 25%, a verificar visualmente. Não são provas de falha de contraste renderizado, mas candidatos objetivos ao piloto.

**Divergência não visual a registrar:** Financeiro contém textos 40%/60%; Projetos contém 35%. A v1 não corrige percentuais ou interpreta contratos. A regra autorizada 35%/65% permanece intocada; os trechos divergentes exigem conferência separada antes de modificar qualquer rótulo percentual. Não padronizar números apenas por consistência estética.

### Auditoria específica da Agenda Geral — fatos de código, não homologação visual

| Área | Fato observado | Tratamento no padrão / limite |
|---|---|---|
| Dia | `DayView`, `StaffColumn`, `SlotCell` ficam dentro de `agenda.tsx`; `buildDayGrid` em `src/lib/agenda-grid.ts` usa unidades de 30 minutos; linha visual 56px | Não há componente externo “agenda-grid.tsx”. Manter proporção temporal, legibilidade e um evento abrangendo suas unidades |
| Todos | `pickedArtistId` vazio permite conjunto autorizado; desktop exibe colunas; mobile exibe uma coluna ativa com atalhos | “Todos” não significa que todas as colunas estejam simultaneamente visíveis no celular. Escopo geral e coluna ativa devem ser distinguíveis |
| Profissional/calendário | `src/hooks/use-artists.ts` lê profissionais ativos com calendário; `agendaScope` restringe artista ao vínculo, admin pode reduzir escopo | Não ampliar autorização; não hardcodar profissionais. Um seletor independente de calendários ainda não existe na barra atual |
| Acesso Randevu | Atalhos mobile usam `chipAgendas`, que exclui nomes genéricos GF; filtro do topo e colunas derivam da lista ativa | Risco estático de ocultar o acesso de um calendário já carregado, não prova de sua presença na base agora. Expor rótulo de calendário permitido é proposta condicionada à fonte existente; não criar filtro/API fictício |
| GHL | `src/lib/ghl.ts`: eventos via GET `/calendars/events`; disponibilidade via GET `/calendars/{calendarId}/free-slots`, por proxy autenticado existente | Leitura de contratos sem executar requests. Não trocar proxy, token, integração ou calendário |
| Semana/mês | `src/hooks/use-agenda-range.ts` lê eventos por calendário, sem free-slots; Semana adapta dia ativo no mobile; Mês tem sete colunas e abre dia | Não prometer disponibilidade de horários em Semana/Mês; não criar agendamento ao tocar contagem mensal |
| Contagem diária | `bookedCount` no hook conta slots `booked`, não IDs únicos de eventos; o header usa esse agregado com label de sessões | Risco concreto de sessão longa multiplicar resumo. Não corrigir cálculo nesta tarefa; registrar dependência funcional separada antes de afirmar “N sessões” |
| Parcial | Dia usa `Promise.allSettled` e preserva dados parciais; erro com slots presentes não recebe o mesmo destaque do erro vazio. Range devolve events vazio junto de error | Projetar aviso por fonte/calendário e resumo incompleto, sem fabricar zero. Onde contrato não permite comprovar completude, registrar bloqueio, não inventar total |
| Estado visual | CSS `.agenda-session` acentua `appointmentStatus`; badge no cartão usa bucket financeiro quando há altura; Mês agrega buckets financeiros em pontos/contagens | Separar legenda do evento da legenda financeira. O ponto do mês não comprova chegada nem sessão; não mudar mapeamentos ou regras nesta revisão |
| Ficha | Sheet bottom 92dvh no mobile/right no desktop; data/duração, profissional, serviço, status, jornada, contato, financeiro e rastreabilidade | Preservar guardas e comandos; tornar status de cada fonte explícito; não executar edição, importação ou pagamentos no piloto visual |
| Fuso | `agenda-grid.ts` e formatos usam Europe/Brussels; `fromZonedTime` e adição de dias civis aparecem nas funções de limites | Não declarar DST homologado: `shift` usa Date local do navegador e label semanal soma 6×24h. Verificar navegador em outro fuso/DST em tarefa autorizada, sem alterar lógica aqui |
| Responsividade | Coluna horária sticky 48px mobile/56px desktop; colunas desktop com mínimo 140px; cards absolutos; overflow interno; swipe só diário | Testar densidade, foco, duração curta e sobreposição em 393/1280; código não prova ausência de cortes no render |

### Cobertura de todas as áreas existentes

Inspeção ampliada por leitura de trechos de apresentação e inventário de rotas; não se confunde localização de arquivo com validação completa da tela.

| Área | Caminhos reais | Evidência e cobertura visual |
|---|---|---|
| Login e recuperação | `src/routes/auth.tsx`, `auth_.recover.tsx`, `auth_.update-password.tsx`; `src/components/auth/auth-frame.tsx` | Login inspecionado na versão inicial; recuperação localizada. Mesmo formulário, títulos e estados; handlers preservados |
| Home/Meu Dia | `src/routes/_authenticated/home.tsx`; `src/components/my-day.tsx` | Lista, fontes e indicadores independentes já inventariados |
| Totem/Check-in/Fila | `src/routes/totem.index.tsx`, `totem.buscar.tsx`, `totem.confirmar.tsx`, `totem.pronto.tsx`; `src/routes/_authenticated/_admin/admin.fila.tsx`; `src/components/checkin/fila-aguardando.tsx` | Welcome/confirmar/fila inspecionados: uppercase, raios maiores e alguns comandos HTML; busca/pronto localizados. Chegada e consentimento preservados |
| Novo agendamento/wizard | `src/routes/_authenticated/appointments.new.tsx`, `appointments.new.index.tsx`, `appointments.new.cliente.tsx`, `appointments.new.projeto.tsx`, `appointments.new.agenda.tsx`, `appointments.new.servicos.tsx`, `appointments.new.revisao.tsx`; `src/components/appointment-wizard/stepper.tsx`, `wizard-footer.tsx` | Layout/projeto/agenda/stepper/footer lidos; stepper 36px e labels 11px; footer 48px. Demais passos localizados; não modificar decisões, rascunho ou submissão |
| Randevu/Orçamento | Agenda e ficha; contexto em `appointments.new.projeto.tsx`; diagnóstico `src/routes/_authenticated/_admin/ghl-test.tsx` | Nenhuma rota operacional dedicada Randevu/Orçamento encontrada no inventário. Diagnóstico não é página de orçamento; contém teste create/delete que não deve ser executado |
| Projetos multi-sessão | `src/routes/_authenticated/projetos.index.tsx`, `projetos.$projectId.tsx`; componentes de jornada/continuidade | Apresentação já inventariada; um projeto contém seus compromissos, consulta não é sessão |
| Reconciliar | `src/routes/_authenticated/_admin/reconciliar.tsx` | Header 36px voltar, cards/disclosures e comandos de sync/backfill/resolução; inspeção sem acioná-los |
| Financeiro e lançamentos | `src/routes/_authenticated/financeiro.tsx`, `movimentacao.index.tsx`, `movimentacao.historico.$id.editar.tsx`; `src/routes/movimentacao.$slug.tsx`, `movimentacao.historico.tsx` | Financeiro já inspecionado; formulários/históricos adicionais localizados. Mesmo padrão sem mudar fontes/lançamentos |
| Relatórios | `src/routes/_authenticated/relatorios.movimentacoes.tsx`, `src/routes/_authenticated/_admin/relatorios.agendamentos.tsx` | Áreas já inventariadas; pagamentos e agenda não são fonte única |
| Equipe/vendedores | `src/routes/_authenticated/_admin/admin.equipe.tsx`, `admin.vendedores.tsx` | Equipe lida: uppercase, diálogo, convites e comissão default 40 no formulário; vendedores localizado. Não resolver divergência contratual nem alterar vínculos |
| Perfil/ajustes | `src/routes/_authenticated/menu.tsx`, `onboarding.tsx`, `onboarding.perfil.tsx`, `onboarding.disponibilidade.tsx`, `onboarding.servicos.tsx`, `onboarding.bem-vindo.tsx`, `onboarding.pronto.tsx`; `src/routes/_authenticated/_admin/admin.configuracoes.tsx` | Menu/perfil/configurações inspecionados; notificações/idioma são “Em breve”, não controles funcionais. Restante localizado; não ativar integração ou novas preferências |
| Demais superfícies | `src/routes/_authenticated/services.tsx`, `reviews.tsx`, `painel-tatuador.tsx`; `src/routes/_authenticated/_admin/admin.saude.tsx`, `admin.movimentacao-links.tsx`, `admin.movimentacao.novo.tsx`; `src/routes/connect.tsx`, `a.$token.tsx`, `mcp.ts`, `index.tsx` | Rotas localizadas: recebem padrão geral conforme função, sem novo protagonismo, acesso ou diagnóstico inventado. Endpoints técnicos não viram páginas operacionais |

## 2. Conceito criativo e escolha

**Conceito: “Agenda viva do estúdio”.** A Agenda Geral organiza a identidade: data e escopo claros, horários escaneáveis, cliente e profissional identificáveis, estados por fonte e ficha consistente. As demais telas reutilizam sua hierarquia, controles, tipografia e densidade, adaptados à função — não copiam uma grade onde ela não serve. A sensação premium vem de leitura e precisão, não de brilho ou área vazia.

| Direção viável | Prós | Contras / esforço |
|---|---|---|
| A — Editorial operacional em grafite | Mantém reconhecimento e default dark; respeita Fases A/B/C; mudanças graduais; acentos funcionais distinguem estados | Exige medir contraste em superfícies escuras e reduzir dependência de dourado/sombras |
| B — Operacional claro, papel neutro | Bom para leitura prolongada, relatório/desktop e ambientes iluminados; forte diferenciação entre texto e fundo | Tema claro ainda não implementado; exige validar marca, todos os estados e overlays; mudança de identidade mais perceptível |

**Recomendação v1, não aprovada: A.** É a transição de menor risco diante do dark atual, não uma imposição de preto+dourado. Base grafite quase neutra e dourado pontual; verde, coral, âmbar e azul têm papéis funcionais. B continua alternativa viável: comparar ambas na mesma anatomia de Agenda Geral, com Dia/Semana/Mês e ficha, antes de escolher implementação. Dark exige cuidado com textura, contraste e fundos próximos; light exige tema completo e validação de marca/overlays, não simples inversão. Nenhuma paleta muda hoje.

### Princípios

1. Uma hierarquia reconhecível: título → contexto → ação → dados → fonte/pendência.
2. Nome, horário e próximo passo no primeiro bloco útil; administração avançada fora do foco principal.
3. Seções abertas com divisórias; cards apenas para itens repetidos ou ferramentas realmente enquadradas. Nunca card dentro de card por decoração.
4. Caixa natural; GF e siglas conservam grafia. Espaçamento entre letras 0; não encurtar nome financeiro crítico por truncamento.
5. Cor complementa texto, ícone e forma; não autentica presença, venda ou recebimento.
6. O desconhecido é visível: “A verificar”, “Indisponível”, “A apurar” ou “A conciliar”, não zero inventado.
7. Contratos, identidade, filtros, navegação e fontes permanecem iguais durante migração visual.
8. Sem neon, glow, gradiente decorativo, glass obrigatório, métricas vazias ou frases promocionais.

## 3. Cores semânticas v1

São **25 tokens propostos**, não valores já aplicados. Nomes compatíveis com o padrão `:root`/`.dark` e `@theme inline` atual. HEX é aproximação sRGB para inspeção, não fonte de implementação. No futuro, classes semânticas (`bg-background`, `text-foreground`, `border-input`) continuam obrigatórias; evitar cores avulsas em componentes.

| Token CSS | Dark OKLCH | HEX aprox. | Claro OKLCH | HEX aprox. | Papel |
|---|---|---|---|---|---|
| `--background` | `0.17 0.004 80` | #100F0D | `0.98 0.002 80` | #F9F8F7 | Plano da página |
| `--foreground` | `0.94 0.008 84` | #EEEBE5 | `0.23 0.005 80` | #1E1D1A | Texto principal |
| `--card` | `0.22 0.005 80` | #1C1A18 | `1 0 0` | #FFFFFF | Item enquadrado |
| `--card-foreground` | `0.94 0.008 84` | #EEEBE5 | `0.23 0.005 80` | #1E1D1A | Texto no item |
| `--popover` | `0.24 0.005 80` | #201F1D | `1 0 0` | #FFFFFF | Menu/sheet |
| `--popover-foreground` | `0.94 0.008 84` | #EEEBE5 | `0.23 0.005 80` | #1E1D1A | Texto no menu |
| `--primary` | `0.76 0.095 86` | #CCAD68 | `0.46 0.075 86` | #6B5521 | Ação principal/seleção |
| `--primary-foreground` | `0.17 0.004 80` | #100F0D | `0.99 0 0` | #FCFCFC | Texto na ação |
| `--secondary` | `0.28 0.005 80` | #2A2926 | `0.94 0.003 80` | #ECEBE9 | Controle secundário |
| `--secondary-foreground` | `0.94 0.008 84` | #EEEBE5 | `0.23 0.005 80` | #1E1D1A | Texto secundário ativo |
| `--muted` | `0.26 0.005 80` | #252421 | `0.94 0.003 80` | #ECEBE9 | Área neutra/skeleton |
| `--muted-foreground` | `0.76 0.01 84` | #B4B1AA | `0.48 0.008 80` | #605D59 | Metadados legíveis |
| `--accent` | `0.30 0.02 84` | #332D22 | `0.93 0.018 84` | #EEE7DB | Hover/seleção suave |
| `--accent-foreground` | `0.94 0.008 84` | #EEEBE5 | `0.23 0.005 80` | #1E1D1A | Texto sobre accent |
| `--border` | `0.40 0.008 80` | #4A4743 | `0.81 0.005 80` | #C2C0BD | Divisória decorativa |
| `--input` | `0.56 0.008 80` | #77746F | `0.60 0.006 80` | #82807C | Limite interativo |
| `--ring` | `0.76 0.095 86` | #CCAD68 | `0.46 0.075 86` | #6B5521 | Foco visível |
| `--destructive` | `0.72 0.15 25` | #F47B74 | `0.46 0.15 25` | #9A2929 | Erro/ação destrutiva |
| `--destructive-foreground` | `0.17 0.004 80` | #100F0D | `0.99 0 0` | #FCFCFC | Texto sobre erro sólido |
| `--success` | `0.76 0.12 155` | #6DC88F | `0.45 0.09 155` | #23643F | Sucesso comprovado na fonte |
| `--success-foreground` | `0.17 0.004 80` | #100F0D | `0.99 0 0` | #FCFCFC | Texto sobre sucesso sólido |
| `--warning` | `0.80 0.12 65` | #F3AD66 | `0.47 0.09 65` | #7D4F1B | Alerta/pendência |
| `--warning-foreground` | `0.17 0.004 80` | #100F0D | `0.99 0 0` | #FCFCFC | Texto sobre alerta sólido |
| `--info` | `0.77 0.08 235` | #81BDE0 | `0.46 0.08 235` | #225F7E | Informação/agenda confirmada |
| `--info-foreground` | `0.17 0.004 80` | #100F0D | `0.99 0 0` | #FCFCFC | Texto sobre info sólida |

Cada tripla da tabela deve ser envolvida em `oklch(...)`. Tokens auxiliares existentes de sidebar, gráficos e `agenda-warning` não são removidos; futura implementação deve alinhá-los aos papéis acima após aprovação. Não redefinir estados do CRM para adequar cores. Tema claro não deve ser implementado parcialmente em componentes.

### Contraste calculado e regras de aplicação

Calculado na elaboração inicial deste documento por conversão OKLCH → sRGB linear (clipping ao gamut), luminância relativa WCAG e razão `(Lmaior + 0.05)/(Lmenor + 0.05)`. Resultados preservados nesta revisão, para pares opacos propostos; não certificam telas renderizadas, transparências ou combinações arbitrárias.

| Par opaco | Dark | Claro |
|---|---:|---:|
| foreground / background | 16.04:1 | 15.95:1 |
| muted-foreground / card | 8.06:1 | 6.54:1 |
| primary / primary-foreground | 8.88:1 | 6.96:1 |
| destructive / destructive-foreground | 7.22:1 | 7.49:1 |
| success / success-foreground | 9.35:1 | 6.91:1 |
| warning / warning-foreground | 10.00:1 | 6.79:1 |
| info / info-foreground | 9.36:1 | 6.81:1 |
| input / card | 3.72:1 | 3.95:1 |
| ring / background | 8.88:1 | 6.76:1 |

Meta: **≥4.5:1 para todo texto**, inclusive auxiliar; **≥3:1 para limites interativos e foco**. `border` é separador decorativo, não substitui `input`/`ring`. Status textual usa cor de status sobre superfície opaca; badge sólido usa seu `*-foreground`. Qualquer badge translúcido requer medição após composição. Não diminuir opacidade de texto secundário. Textura da grade atual só pode permanecer em áreas livres, discreta; formulários, dados e tabelas devem usar planos sólidos para contraste previsível. Sem nova textura/imagem gerada.

## 4. Tipografia e números

**Duas famílias-alvo, ambas já presentes no projeto:** Rubik para operação; Cormorant Garamond para títulos editoriais. Space Mono deixa de ser usada na UI gradualmente, após aprovação; não remover carregamento nem aliases enquanto telas não migradas dependerem dela. Durante transição haverá legado de três famílias, mas cada piloto deve usar apenas as duas-alvo. Nenhuma nova instalação de fonte.

| Papel | Família / peso | Mobile px / entrelinha | Desktop px / entrelinha |
|---|---|---|---|
| Título de página | Cormorant 600 | 28 / 32 | 32 / 36 |
| Título de seção editorial | Cormorant 600 | 22 / 28 | 24 / 32 |
| Nome de cliente / título de item | Rubik 600 | 16 / 24 | 16 / 24 |
| Corpo / campo | Rubik 400 | 16 / 24 | 16 / 24 |
| Botão / filtro | Rubik 500–600 | 14 / 20 | 14 / 20 |
| Label / metadado | Rubik 400–500 | 12 / 18 | 12 / 18 |
| Número principal | Rubik 600 | 28 / 32 | 32 / 36 |
| Valor financeiro de linha | Rubik 500–600 | 16 / 24 | 16 / 24 |
| Cabeçalho de tabela | Rubik 500 | 12 / 18 | 12 / 18 |

Tamanhos fixos por breakpoint, sem fonte proporcional à largura da viewport. Tracking 0. Inputs mobile **16px**, inclusive select nativo. Financeiro: `font-variant-numeric: tabular-nums lining-nums`; alinhamento à direita em colunas; EUR com centavos e formatação existente, sem alterar valores/arredondamento. Nunca usar Cormorant em totais, horário, campo ou tabela. Título quebra em até duas linhas; valores longos passam à linha seguinte ou a uma coluna, não encolhem abaixo do mínimo. Nomes não viram uppercase; siglas e marca permanecem fiéis.

## 5. Geometria, densidade e superfícies

- Escala 4/8: **4, 8, 12, 16, 24, 32, 40, 48, 64px**. Gap interno 8–12; padding de item 16; distância de seções 24–32.
- Radius: base **8px**, controles **6px**, badges **4px**; círculo apenas avatar/ícone familiar. Sheets móveis com cantos superiores 8px; sem aumentar raios para dar aparência premium.
- Elevação: borda por padrão, sem sombra em listas/métricas. Uma sombra semântica compartilhada somente em popover/sheet; overlay derivado do background, não `bg-black` avulso. Não criar glow.
- Conteúdo operacional máximo **1152px** (max-w-6xl); detalhes/leitura **768px**. Agenda mantém necessidade de grid largo até **1400px**, com rolagem apenas interna onde necessária.
- **393px:** 16px de margem horizontal → 361px úteis. Uma coluna de lista; métricas em duas colunas com 16px de gap (172.5px por coluna); valores extensos ocupam a largura inteira. Filtros críticos visíveis, secundários em disclosure sem perder seleção.
- **1280px:** conteúdo 1152px centralizado → 64px por lado; grid 12 colunas com gaps 24px, painéis operacionais 6+6; até quatro métricas abertas por faixa. Detalhe centrado em 768px. Não expandir texto de leitura até a largura da tela.
- 640px e 1024px são transições de composição compatíveis com breakpoints atuais; testar também 320/360px e tablet, sem alegar aprovação nesta tarefa.
- Safe area: somar `env(safe-area-inset-top/bottom/left/right)` quando houver barra fixa. Conteúdo recebe altura real da bottom-nav + safe area + 16px; não empilhar reservas duplicadas. Manter gesto diário apenas na grade da Agenda e scroll nativo fora dela.
- Headers desktop não podem competir em `top:0`: PageHeader abaixo da TopBar de 64px ou não-sticky na composição aprovada; mobile mantém contexto compacto. Não modificar comportamento de navegação.
- Densidade padrão: linha clicável 64–88px conforme metadados; alvo nunca menor que 44×44px. Grade diária mantém unidade 56px já existente; não alterar a duração representada por cada unidade.

## 6. Componentes-base e contratos visuais

Reusar APIs e primitivas atuais; os nomes abaixo são padrões visuais, não autorização para criar novos módulos ou dependências. “Metric” e “SummaryCard” não existem hoje como primitivas compartilhadas com esses nomes.

| Padrão | Anatomia / estados | Fonte exata para futura implementação |
|---|---|---|
| PageHeader | Marca/voltar opcional; h1 legível; contexto de data/fonte; uma ação prioritária; ações quebram abaixo no mobile | `src/components/ui/page-header.tsx`; headers locais em Home/Agenda/Projetos/Painel |
| Metric | Label 12px → valor Rubik tabular → fonte/limitação; sem card decorativo; null = indisponível | Resumo da Agenda em `src/routes/_authenticated/agenda.tsx`, somente após verificar semântica da contagem; `src/components/my-day.tsx`; `src/components/ui/stat-card.tsx` |
| SummaryCard | Grupo de valores de uma mesma fonte; título e fonte explícitos; pode ser faixa aberta; não agregar eixos incompatíveis | `src/components/project-commercial-summary.tsx`; `src/components/ui/stat-card.tsx` |
| AppointmentRow | Horário + cliente; tatuador/calendário; status de agenda; check-in em linha distinta quando fonte autorizada; abrir ficha 44px | `SlotCell`/`StaffColumn`/`WeekView` em `src/routes/_authenticated/agenda.tsx`; `src/components/my-day.tsx` |
| ProjectCard | Cliente/projeto; artista somente quando autorizado; contagem vinculada; próxima data; pendência; valor apenas se autorizado e fonte clara | `ProjectCard` local em `src/routes/_authenticated/projetos.index.tsx`; `src/components/project-continuity.tsx` |
| Badge | Texto em caixa natural + ícone opcional; neutral/info/warning/success/danger; não-interativo não precisa altura 44px | `src/components/ui/status-badge.tsx`; manter mapeamentos de negócio existentes |
| Filters | Segmentado para 2–4 modos; Select para profissionais/opções extensas; seleção visível e limpar 44px; preservar search params | `FilterRow` em Financeiro; `src/components/ui/select.tsx`; filtros locais em Projetos/relatórios |
| Tabs | Modos de mesma área; 44px por alvo, ativo por texto/indicador e cor; foco e setas Radix preservados | `src/components/ui/tabs.tsx`; Agenda |
| Form | Label associado; ajuda/erro abaixo; input 48px/16px mobile; uma submissão; erro próximo ao campo | `src/components/ui/input.tsx`, `select.tsx`; `src/routes/auth.tsx`; `Field` locais de relatório |
| Button | Default 44px, lg 48px, icon 44×44px; `sm` visual não reduz alvo; loading mantém tamanho; destrutivo distinto | `src/components/ui/button.tsx`; comandos usam Button/asChild, não botões HTML avulsos |
| Sheet | Mobile bottom até 92dvh, desktop right 448px; header fixo, corpo rolável, fechar 44px/“Fechar”; foco preso e restaurado | `src/components/ui/sheet.tsx`; `src/components/agenda-appointment-sheet.tsx` |
| Table responsive | Cabeçalho 12px, células 14–16px; números alinhados; mobile linhas empilhadas ou overflow interno acessível | `src/components/ui/table.tsx`; tabelas Financeiro e relatório mensal |
| Empty | Fonte carregou, zero linhas para filtro; texto contextual e ação existente, sem incentivo a criar duplicação | `src/components/ui/empty-state.tsx` |
| Error / partial | Fonte afetada explícita; retry 44px; manter dado anterior identificado como desatualizado; 403/404 neutros sem vazamento | `src/components/ui/error-state.tsx`; MyDay; resumo comercial; painel |
| Loading | Região com status acessível, reserva dimensional; skeleton neutro; sem valores fictícios | `src/components/ui/loading-state.tsx`; skeleton por coluna da Agenda |

## 7. Estados operacionais e segurança de apresentação

Não criar um badge único “Tudo confirmado”. Cada eixo mantém origem e texto próprios:

| Eixo | Exibição aceitável | Nunca inferir |
|---|---|---|
| Agenda | “Confirmado · agenda”, “Cancelado · registrado”, “No horário previsto” | confirmed/booked ou horário atual = chegou/em sessão |
| Check-in | “Chegou”, “Aguardando”, “Em atendimento”, “Concluído · check-in”, quando leitura autorizada comprova | Sem check-in = faltou; status de agenda = presença |
| Comercial GHL | Status recebido de fonte confiável; caso contrário “Status comercial não verificado aqui” | WON = sessão realizada; três oportunidades = três projetos |
| Continuidade | Próximo agendamento real ou “Sem próxima sessão marcada” + “Continuidade a verificar” | Sem futura = abandono/conclusão |
| Financeiro | Referência comercial, sinal informado, caixa registrado, comissão apurada e repasse separados | Anotação de sinal = caixa do estúdio/comissão elegível/repasse |
| Vínculo | Confirmado, incompleto, ausente, indisponível | Mesmo contato/nome = mesmo projeto; consulta = sessão |

Cor é apoio, não prova; manter texto e ícone/estrutura. Status “showed” vindo do calendário permanece identificável como calendário, não é reinterpretado como check-in. Oportunidade sem evidência permanece não verificada. IDs técnicos não entram na leitura cotidiana; rastreabilidade administrativa existente deve ficar secundária, sem ampliar acesso.

### Invariantes de autorização e dinheiro

- Artista recebe apenas seus dados e valores previamente autorizados; bruto, 65%, saldo do estúdio e dados de outros artistas não podem existir em seu payload. Ocultar CSS não é segurança.
- Áreas restritas continuam restritas; esta v1 não libera novos perfis nem declara RLS homologada. Qualquer liberação depende de tarefa de segurança separada e verificação entre identidades reais.
- Não alterar 35%/65%, `commission_pct`, arredondamento, `project-progress-core`, pagamentos, movimentações, status, oportunidades, calendários ou consultas. Inconsistências 40/60 existentes ficam registradas, não resolvidas por design.
- Dados incompletos não viram totais; fonte ausente não vira zero. Não adicionar caixas, recebimentos ou repasses para preencher métricas.
- Referência de datas: **Europe/Brussels**, inclusive DST; migração visual conserva conversões existentes e registra divergências sem mudar lógica de períodos.

### Exemplo financeiro anonimizado — somente apresentação administrativa

Exemplo de integridade, sem nomes privados; **não houve SELECT nesta revisão**. Não hardcodar o exemplo nem acrescentar valores que a fonte atual não entrega.

| Bloco | Valor / regra |
|---|---|
| Projeto | Um projeto de **2.700,00 €**, não três vendas locais |
| Sinal informado | **450,00 €**; payment existente recebido diretamente pelo profissional; anotação do projeto não é uma segunda entrada |
| Saldo comercial indicativo | **2.250,00 €**, somente na referência comercial sem dedução duplicada |
| Recebido no caixa | **0,00 €** pela ausência confirmada de movimentações do projeto; não significa que o cliente não pagou sinal |
| Saldo apurado por movimentações | **2.700,00 €**; não rotular como dívida comercial do cliente; conciliação/repasse pendentes |
| Continuidade | Três compromissos: **05, 06 e 20/12/2026**; consulta de 01/11 preservada fora da contagem |
| CRM | Três oportunidades abertas de 900 € sem mapeamento confiável; não marcar WON nem atribuir oportunidade por data |
| Tipo | Default de cadastro não é confirmação; não rotular cobertura ou tipo novo sem prova |

Se houver outras movimentações ou ponte desconhecida, o saldo comercial fica **“A conciliar”**, nunca `2700 − sinal − caixa` cegamente. Não apresentar sinal como base automática de comissão; recebimento direto não comprova caixa, elegibilidade ou repasse. O resumo atual lê sinal do projeto e explica falta de ponte auditável ao payment; data/meio/recebedor não devem ser acrescentados à UI por hardcode. Consulta continua independente, nunca quarta sessão.

## 8. Anatomia das telas

### Agenda Geral — tela mestra e Piloto 1

**Hierarquia comum a todo o sistema:** contexto/data → escopo → modo → dados operacionais → detalhe → fonte/pendência. A Agenda estabelece alinhamentos, superfícies, estados e controles compartilhados.

**Desktop 1280px:** header abaixo da estrutura global, data/período à esquerda, anterior/Hoje/próximo e Dia/Semana/Mês alinhados; faixa de filtros Todos/profissional e identificação dos calendários permitidos; grade ocupa o espaço principal. Coluna de horas 56px fixa; colunas de profissionais/calendários com mínimo legível 140px e scroll interno se excederem largura. Não comprimir todos em colunas ilegíveis. Ficha direita 448px sobreposta como hoje, sem esmagar a grade; fechar devolve foco ao evento e mantém scroll/data/escopo.

**Mobile 393px:** header/data em primeira linha; navegação temporal e modo em segunda; escopo em faixa própria, sem competir com nome da data. Dia/Semana/Mês acessíveis pelo controle existente, cada alvo 44px. Todos é escopo administrativo; coluna ativa é identificação local separada. Manter escolha de coluna e lista/grade adaptada, sem alegar simultaneidade de todos. Horas 48px sticky, conteúdo sem overflow do body; ficha bottom até 92dvh, header e fechar fixos, corpo rolável e safe area.

**Filtros e calendários:** usar apenas itens fornecidos pelo cadastro/escopo autorizado. Todos e artista já existem; identificação ou seleção independente de calendário é proposta somente se os IDs e a fonte existente permitirem, sem nova consulta/permissão. Distinguir calendário Randevu da natureza comprovada do atendimento; rótulo de calendário não converte todo evento em consulta ou tatuagem. Não filtrar por nome hardcoded, não reativar profissional ou criar calendário. A eventual correção do acesso oculto requer execução separada, não aconteceu neste documento.

**Dia:** preservar grade 56px por 30 minutos, duração e sobreposição. Cartão prioriza cliente e horário; profissional/calendário visível no cabeçalho e nome acessível; estado textual do evento. Em cartão curto não empilhar cinco labels: cliente/horário primeiro, demais informações na ficha e nome acessível. Fora de disponibilidade não é horário livre. Badge de pagamento é metadado separado, nunca cor-mestra de presença.

**Semana:** manter sete dias no desktop e dia ativo/lista no celular; identificação do profissional em cada grupo/evento. Mesmos filtros e mesma ficha. Não disponibilizar free-slots fictícios nem reduzir labels a 10px para caber.

**Mês:** sete colunas com dias clicáveis ≥44px; contagem tem rótulo acessível “agendamentos”, não “sessões de tatuagem” sem prova. Abrir dia para ler lista completa; contagem/pontos financeiros existentes precisam legenda distinta, não podem significar check-in. Não prometer conclusão financeira ou cobertura integral sem fonte.

**Legenda textual acessível:** “Confirmado · agenda”, “Novo · agenda”, “Cancelado · agenda”, “Situação a verificar”; disponibilidade: “Horário livre”/“Fora da disponibilidade”; “Sobreposição” com ícone e texto. Estado financeiro, quando exibido, tem legenda própria “Pagamento”. Chegada/check-in e comercial só aparecem quando a fonte autorizada realmente os entrega; caso contrário, “Não verificado nesta ficha”. Não criar consulta de check-in/GHL para completar um cartão visual.

**Harden:** loading por coluna preserva geometria; falha de disponibilidade não apaga eventos válidos; falha de eventos não comprova agenda vazia; parcial identifica fonte e calendário afetado; resumo incompleto não vira zero ou número completo. Semana/mês têm erro e loading próprios, não apenas células vazias. Onde faltam contratos para isso, registrar dependência fora do escopo visual.

**Polish/foco/scroll:** alinhar horários e bordas; limite 8px para itens; zero tracking; foco 2px reconhecível sem clipping; título quebra antes de reduzir fonte. Manter scroll vertical, pinch zoom e axis-lock do swipe diário; retornar da ficha ao evento original. Testar cartão curto, longo, concomitante, nome extenso, Todos, calendário permitido e falta de fonte em 393/1280. Esses são critérios definidos, não resultados implementados.

### Ficha do Agendamento — parte do Piloto 1

`src/components/agenda-appointment-sheet.tsx` + `src/components/appointment-project-journey.tsx`. Ordem visual: cliente/data/duração → profissional e calendário permitido → status do evento explicitamente “Agenda” → detalhes/natureza comprovada ou não verificada → jornada/progresso/próxima data → financeiro autorizado em bloco separado → contato autorizado → rastreabilidade secundária. Consulta Randevu não entra na contagem de sessões. Nenhum status de pagamento ou comercial substitui status do evento/check-in. Sheet em 393/1280 usa fechar 44px, foco restaurado, estados independentes de jornada/contato/financeiro e erro sem dados privados. Guardas e comandos preservados, sem acioná-los em piloto visual.

### Login
`src/components/auth/auth-frame.tsx` + `src/routes/auth.tsx`. Marca original, altura proposta 48–56px mobile/64px desktop; título 28/32; campos imediatamente após contexto breve, sem separador ornamental. Formulário largura máxima 400px; mobile sem grande card dentro da página, desktop enquadramento discreto permitido. Ordem preservada: email → senha/esqueci → erro → entrar → alternativa Google. Manter autenticação, redirect, validação e provedores como estão.

Meta de piloto em 393×852: primeiro input começa até y=280, botão Entrar e alternativa Google acessíveis sem corte; em viewport baixa/teclado permitir scroll, sem exigir tudo acima da dobra. Logo nunca empurra operação para baixo. Medir antes/depois, não afirmar problema resolvido por documento.

### Meu Dia
`src/routes/_authenticated/home.tsx` + `src/components/my-day.tsx`. Reutilizar header, fontes e linhas da Agenda: data, cinco indicadores em faixa aberta, filtros, lista cronológica e chegadas sem vínculo separadas. Atalhos existentes permanecem, sem destacar uma área secundária. Fila antiga e MyDay não são somados ou renomeados como equivalentes. Chegada/início/conclusão são metadados em segunda camada, sem removê-los. Estados parciais próximos da fonte afetada.

### Totem, Check-in e Fila
Rotas e componente de fila listados no inventário. Mesma marca, tokens e labels da Agenda; Totem mantém ações grandes e linguagem de chegada, não linguagem financeira. Busca → confirmação → pronto preservados; consentimento não vira toggle ornamental. Fila reutiliza linha operacional, horário e estados de check-in explícitos; iniciar/concluir permanecem comandos autorizados atuais. Não executá-los nesta revisão nem concluir presença por horário. 393px uma coluna; 1280px área central sem esticar formulário; fonte de erro/vazio sempre distinta.

### Novo agendamento e wizard
Rotas `appointments.new.*` e componentes `appointment-wizard` listados no inventário. Data/escopo e controles vêm da Agenda; etapa atual com label legível e progresso acessível, sem cinco pills apertadas de 11px. Campos 16px mobile, rodapé 48px acima da safe area/teclado. Preservar Cliente → Projeto → Agenda → Serviços → Revisão e decisões new/reuse; sessões individualizadas, revisão das datas e sinal sem repetição. Ajuste visual não muda validação, disponibilidade, rascunho, `finalizeBooking` ou chamadas CRM.

### Randevu / contexto de orçamento
Sem página dedicada comprovada: tratar na Agenda/ficha e contexto de projeto existente, não inventar `/randevu` ou `/orcamento`. Nome do calendário é contexto, não prova de tipo; consulta preservada independentemente de projeto/sessões. Diagnóstico GHL continua separado da operação e fora de testes de escrita do piloto.

### Projetos
`src/routes/_authenticated/projetos.index.tsx` e `projetos.$projectId.tsx`. Lista: header, filtros preservados, projeto único por item, próxima data, contagem e pendência. Detalhe: cliente/projeto → continuidade → histórico → referência comercial admin → caixa admin → parcela própria autorizada. Labels de saldo devem mencionar a fonte real; não alterar a lista para mostrar saldo comercial com cálculo de caixa. Preservar Fase B, consulta independente e identidade do projeto. Nenhuma ação de agendar é automatizada por design.

### Reconciliação
`src/routes/_authenticated/_admin/reconciliar.tsx`. Header derivado da Agenda; pendências por origem e detalhe expansível; resolução/sync/backfill com hierarquia e confirmação existentes preservadas. “Nenhuma falha aberta” não comprova sincronização integral. Controles 44px; IDs/payloads técnicos ficam secundários e só para perfis atuais. Não reprocessar, preencher nomes ou marcar resolvido em revisão visual.

### Financeiro
`src/routes/_authenticated/financeiro.tsx`. Header, filtros primários compactos, seletores administrativos quando já permitidos; indicadores por sua fonte, itens mobile e tabela desktop. Não seis cards igualmente fortes; priorizar o indicador autorizado central e deixar outros secundários sem esconder dado. Preservar sync/reconciliação existentes e não os executar no piloto. Textos 40/60 permanecem sinalizados para decisão separada; não normalizar percentual por aparência.

### Relatórios
`src/routes/_authenticated/relatorios.movimentacoes.tsx` e `src/routes/_authenticated/_admin/relatorios.agendamentos.tsx`. Título legível, período/filtros, ações exportar/imprimir secundárias, resumo da fonte, detalhamento. Separar pagamentos de agendamentos; não tratar relatórios como a mesma fonte. Mobile: filtro avançado recolhível, linhas empilhadas ou tabela interna; desktop tabela completa. Impressão sem textura/nav; preservar templates/exportações e o conjunto de registros. Não alterar `src/lib/report-html.ts` ou agregações nesta migração visual.

### Equipe, Perfil e ajustes; demais áreas
Equipe/vendedores usam header, linha/card repetido, diálogo e form compartilhados, sem alterar convites, calendar IDs, ativação ou comissão. Menu/perfil mantêm destinos/guardas; upload e especialidades usam alvos 44px; “Em breve” continua não implementado. Configurações mantêm preparação/bloqueios de integração e histórico, sem ativar filas. Serviços, avaliações, onboarding, saúde, links e áreas auxiliares existentes recebem o padrão da Agenda conforme função; tabelas/formulários não viram grades de calendário. A área de acompanhamento individual permanece existente, sem ser foco, piloto ou matriz. Superfícies apenas localizadas exigem leitura aprofundada antes de futura implementação; não há diagnóstico visual inventado para elas.

## 9. Manter / alterar / não tocar

“Alterar” abaixo é **proposta futura**, não alteração realizada ou autorizada por este documento.

| Manter | Alterar após aprovação visual | Não tocar |
|---|---|---|
| Marca e assets reais GF | Escala do logo no login e distância até campos | Arquivos de marca, credenciais, provedores ou redirects |
| Dark atual durante transição | Contraste dos tokens por piloto, dourado mais pontual | Troca global para light sem homologação |
| Rubik e Cormorant já disponíveis | Uso tipográfico; retirar Space Mono da UI progressivamente | Instalações, package, plugins |
| Radius base 8px e safe area | Padronização de gaps, linhas, headers e targets | Navegação/destinos, gestures e booking |
| Fases A/B/C, fontes e permissões | Composição/labels explicativos aprovados | APIs, auth, RLS/schema, server functions, escopo de payload |
| Financeiro comercial/caixa separado | Hierarquia das fontes e pendências | Valores, percentuais, cálculo, pagamento ou movimentação |
| Consulta e histórico preservados | Leitura da jornada e próxima data | IDs, vínculos, check-in, GHL/WON ou sincronização |

## 10. Migração somente visual e checkpoints

Nenhuma etapa é executada nesta entrega. Cada checkpoint requer aprovação expressa; sem aprovação, parar no documento. Não atualizar plano, roadmap ou conhecimento do projeto. Sem publicação.

1. **Checkpoint 0 — direção/tokens:** aprovar A, duas famílias, tabela de cores, densidade e textos de fonte; aprovar ou adiar alternativa clara. Não aplicar tema global primeiro.
2. **Piloto 1 — Agenda Geral + Ficha do Agendamento:** Dia/Semana/Mês, Todos, profissional e calendário permitido; comparar 393×852 e 1280×900. Homologar hierarquia, grade, legenda por fonte, scroll, foco, disponibilidade, curto/longo/sobreposto e loading/parcial/erro. Sem novos filtros de dados nem requests. Esta é a matriz para expansão.
3. **Piloto 2 — Meu Dia + Totem/Fila:** reutilizar header, linhas e estados da Agenda; preservar fontes, chegadas, consentimento e autorização. Comparar mesma identidade em operação da equipe e atendimento público, sem registrar check-in nos dados reais.
4. **Piloto 3 — Novo agendamento + Projetos + Reconciliação:** reutilizar controles, datas, sheet/dialog, continuidade e pendências; manter etapas/decisões/vínculos. Testar apenas cenários sintéticos sem finalizar booking, lançar sinal, reprocessar ou alterar GHL.
5. **Piloto 4 — Financeiro, Relatórios, Login e demais áreas:** estender padrão a Equipe, Perfil, ajustes, onboarding, serviços e superfícies existentes restantes. Financeiro mantém fontes/cálculo; login preserva autenticação; áreas apenas localizadas exigem leitura prévia. Não mudar contratos ou ativar controles “Em breve”.
6. **Consolidação:** compartilhar variantes homologadas na Agenda e nos pilotos; ajustar tokens/aliases/fontes apenas após aprovação visual e migração de consumidores. Dark é recomendação, não decisão aprovada; tema claro precisa homologação completa própria. Revisar diff exclusivamente visual; publicação depende de autorização específica posterior.

**Limite para implementações futuras:** se qualquer proposta exigir mudar query, payload, cálculo, fonte, autorização ou esquema, interromper esse item e solicitar autorização em tarefa própria. Não contornar por hardcode, cálculo local alternativo ou busca por contato.

## 11. Critérios de aceite e checklist QA

### 393px mobile

- [ ] Screenshot antes/depois em 393×852; validar também altura 700px com scroll normal e teclado.
- [ ] `scrollWidth ≤ clientWidth` no documento; só grid/tabela explicitamente enquadrados podem rolar internamente.
- [ ] Nenhum título, nome, label, total ou botão cortado/colidindo; testar nomes longos e valor `123.456,78 €` com dados sintéticos.
- [ ] Todo comando/aba/link operacional/fechar ≥44×44px; inputs 48px e fonte computada ≥16px.
- [ ] Conteúdo final e rodapé visíveis acima da bottom-nav + safe area; simulador não substitui iPhone físico.
- [ ] Login com primeiro campo até y=280 em 393×852; erro não elimina acesso à submissão.
- [ ] Agenda com data/escopo/modo legíveis, coluna ativa identificada dentro de Todos, acesso aos calendários já permitidos; nenhuma opção fictícia.
- [ ] Dia/Semana/Mês e ficha operáveis com uma mão; mês abre dia; fechar ficha restaura foco/scroll e mantém filtros existentes.
- [ ] Meu Dia/Totem/Fila em uma coluna de leitura, sem exigir scroll em múltiplas regiões para operação básica.

### 1280px desktop

- [ ] Screenshot antes/depois em 1280×900; conteúdo ≤1152px, detalhe ≤768px, exceção de Agenda documentada.
- [ ] Header da página não sobrepõe TopBar sticky de 64px; título e filtros não competem.
- [ ] Listas em duas áreas quando útil, tabelas escaneáveis e valores tabulares alinhados.
- [ ] Sem grandes vazios decorativos ou seções transformadas em cards aninhados.
- [ ] Agenda Geral em Todos conserva colunas legíveis e horas fixas; scroll interno onde necessário, ficha lateral sem esmagar grade.
- [ ] Mesma hierarquia e legenda de eventos em Dia/Semana/Mês; pagamentos do mês não são interpretados como presença.

### Acessibilidade e estados

- [ ] Medir contraste renderizado ≥4.5:1 em texto normal/auxiliar/status; ≥3:1 em foco/limites necessários, incluindo transparências.
- [ ] Fluxo completo por teclado; foco visível 2px + offset 2px; abrir/fechar sheet restaura foco.
- [ ] Ícones-comando com nome acessível em português; labels associados a campos; sem IDs duplicados.
- [ ] Cada página tem uma região principal coerente, sem aninhamento/duplicação de main; mudança de layout sem reestruturar roteador.
- [ ] Cor nunca única identificação; badges com texto e fonte; título legível com zoom 200%.
- [ ] `prefers-reduced-motion` elimina movimentos não essenciais; transições padrão **120–200ms**, preferencialmente cor/opacity/transform, sem deslocar layout.
- [ ] Loading mantém dimensões; vazio confirmado é distinto de indisponível; erro parcial conserva partes válidas e informa desatualização.
- [ ] 403/404 não revela nomes, financeiro ou detalhes privados; artista não recebe payload bruto. Revisão visual não certifica segurança/RLS.

### Integridade de operação e finanças

- [ ] Mesmo filtro/período e mesmos registros antes/depois; nenhum request adicional ao GHL por decoração.
- [ ] Agenda confirmada não vira chegada; check-in autorizado permanece fonte independente; WON não vira conclusão.
- [ ] Sem próxima data não vira abandono; tipos não comprovados continuam não verificados.
- [ ] Cenário sintético: um projeto, três datas; consulta separada; comercial e caixa sem dedução dupla ou novo recebimento.
- [ ] Artista nunca vê valores integrais; sinal recebido diretamente pelo profissional não vira comissão automática/caixa por visualização.
- [ ] Contagem de slots não é apresentada como contagem comprovada de sessões/eventos; registrar dependência funcional sem mudar cálculo nesta revisão.
- [ ] Percentuais/cálculos e status antes/depois idênticos; divergência 40/60 não “corrigida” por CSS/copy.
- [ ] Datas em Europe/Brussels, incluindo transições DST; nenhum formato muda o dia civil dos dados.
- [ ] Revisar diff: só apresentação, nenhum dado/migração/API/handler alterado; testes existentes aplicáveis executados e contagem relatada sem reutilizar resultado antigo.

## 12. Entrega, verificação realizada e pendências

**Realizado nesta revisão:** releitura real do Impeccable instalado; auditoria estática aprofundada da Agenda, grid, ficha, estilos, hooks e contratos GHL; inventário ampliado de todas as áreas; Agenda Geral definida como tela mestra; quatro pilotos reordenados; nomes privados retirados dos exemplos e critérios. Os 25 tokens, equivalentes HEX, contrastes calculados na versão inicial, tipografia, espaçamento e segurança foram preservados. Dark permanece recomendação não aprovada, comparada ao light operacional.

**Não executado:** implementação visual, scripts de escrita, instalação, build, lint, testes do app, captura visual, leitura de banco, chamadas GHL, mudança de permissões ou publicação. Build/lint/testes não são necessários para criar este Markdown e resultados de tarefas anteriores não são apresentados como validação desta v1.

**Definido, não implementado:** identidade geral proposta, anatomia prioritária da Agenda/ficha e padrão para todo o restante. Esta revisão documental já foi executada, sem nova solicitação de aprovação. Implementação visual futura continua dependente de aprovação da direção/tokens e checkpoints dos quatro pilotos. **Pendente de homologação:** render mobile/desktop, contraste composto, teclado/iPhone, fonte de calendários permitidos, completude/semântica de contagens, DST em outro fuso e divergências financeiras. Essas dependências não autorizam alterações de dados, negócio ou permissões.