
# Reskin GF Tattoo — Tema claro preto/branco

Reskin puramente visual. Nenhum layout, fluxo, rota ou lógica muda. Só tokens de design, fontes, logo e cores de componentes específicos.

## Escopo

- Trocar tema dark → tema claro (branco) como padrão em toda a app.
- Substituir todo roxo/azul/vermelho de destaque por preto `#0A0A0A`.
- Aplicar tipografia: títulos `Archivo Black`, corpo `Inter`.
- Logo caveira GF Tattoo no header e na tela de login/splash.
- Tela de login/splash é a única com fundo preto.

## Mudanças por arquivo

### 1. `src/styles.css` — tokens de design
Reescrever `:root` (e `.dark` espelhando o mesmo, já que a app vive no claro):
- `--background: #FFFFFF`
- `--foreground: #0A0A0A`
- `--card: #FFFFFF`, `--card-foreground: #0A0A0A`
- `--muted: #F5F5F5`, `--muted-foreground: #8A8A8A`
- `--border: #E5E5E5`, `--input: #E5E5E5`
- `--primary: #0A0A0A`, `--primary-foreground: #FFFFFF`
- `--secondary: #F5F5F5`, `--secondary-foreground: #0A0A0A`
- `--accent: #0A0A0A`, `--accent-foreground: #FFFFFF`
- `--ring: #0A0A0A`
- `--destructive`: manter cinza escuro neutro (sem vermelho real na UI; só usado em estados de erro de form — manter discreto)
- `--radius: 1rem` (16px nos cards)
- `--font-display: "Archivo Black", "Anton", sans-serif`
- `--font-sans: "Inter", system-ui, sans-serif`
- Sidebar tokens: claros (branco/cinza), com primary preto

### 2. `src/routes/__root.tsx` — fontes
Adicionar `<link>` para Google Fonts: Archivo Black (400) + Inter (400, 500, 600, 700). Sem `@import` em CSS.

### 3. Logo da caveira
- Gerar/usar imagem da caveira GF Tattoo (PNG transparente) via assets, em duas variantes: preta (para header em fundo branco) e branca (para login/splash em fundo preto).
- Substituir o atual lockup textual/placeholder do header pela logo preta.

### 4. Tela de login/splash
- Localizar a rota atual (provavelmente `src/routes/index.tsx` ou rota de auth). Aplicar **localmente** fundo `#0A0A0A` e a logo branca centralizada, mantendo a mesma estrutura/posicionamento dos elementos existentes. Sem mudar o resto do app.

### 5. Componentes que precisam de ajuste fino (apenas tokens, sem mexer em estrutura)
- **Agenda (`src/routes/agenda.tsx`, `src/lib/agenda-grid.ts`)**: blocos reservados → fundo `bg-muted` (#F5F5F5) + `border-l-4 border-foreground` preta + texto preto. "Sem reserva" → `border border-dashed border-border` cinza, fundo branco. Remover qualquer cor de destaque (roxo/azul).
- **Selecionar serviço (`src/routes/appointments.new.services.tsx`)**: header de categoria sticky em tom de cinza escuro/preto; estado selecionado `bg-muted` em vez de `bg-primary/5` colorido.
- **FAB "+"** e ícones ativos na bottom nav: preto sólido. Verificar bottom nav (componente compartilhado nas rotas) e ajustar classe do estado ativo para `text-foreground` e do FAB para `bg-primary text-primary-foreground` (que agora é preto/branco).
- **Avatares**: círculo `bg-muted` com iniciais `text-foreground`.
- **Botões principais**: variant `default` já fica preto pílula via tokens; garantir `rounded-full` onde for CTA principal (revisão pontual, sem refazer).

### 6. i18n / formato
Já estão configurados PT-PT, EUR, Europe/Brussels (`src/lib/format.ts`). Sem mudanças.

## Fora do escopo (não tocar)

- Lógica de GHL, Supabase, server functions, stores.
- Estrutura de rotas, navegação, fluxos de agendamento.
- Conteúdo de texto (a não ser correção de cor inline hardcoded, se existir).

## Verificação

Após aplicar, abrir via Playwright as telas: `/`, `/agenda`, `/appointments/new`, `/appointments/new/services`, login. Conferir screenshots: fundo branco em todas exceto login (preto), zero roxo/azul, fontes carregadas, logo visível.
