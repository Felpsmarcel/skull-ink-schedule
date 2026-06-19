
# GF Tattoo Studio — Estrutura Base + Tema

Configurar o esqueleto visual e técnico do app. Sem telas funcionais ainda — só fundação sólida para construir em cima.

## 1. Backend (Lovable Cloud)

Ativar Lovable Cloud no início (sem tabelas ainda — só conexão pronta para as próximas etapas: agendamentos, clientes, artistas, etc.).

## 2. Design System (tema tatuagem/streetwear)

Atualizar `src/styles.css` com tokens semânticos em oklch:

- `--background`: preto (#000)
- `--foreground`: branco (#FFF)
- `--card` / `--popover`: cinza escuro (#1A1A1A)
- `--muted` / `--secondary`: cinza médio (#2A2A2A)
- `--border` / `--input`: cinza sutil sobre preto
- `--primary`: vermelho acento (#E11D2A) — para CTAs
- `--primary-foreground`: branco
- `--accent`: vermelho escuro hover
- `--destructive`: vermelho mais forte
- `--radius`: 0.5rem (bordas levemente arredondadas)

Modo escuro como padrão (aplicar classe `dark` no `<html>` via root). Remover esquema claro como protagonista — o app vive no escuro.

Tipografia: importar **Bebas Neue** (headings — peso/atitude streetwear) + **Inter** (corpo — limpa e legível) via `<link>` no `__root.tsx`. Registrar como `--font-display` e `--font-sans` em `@theme`.

## 3. Estrutura mobile-first

- Container global com `max-w-md mx-auto` para travar largura em mobile mesmo em telas maiores (preview/desktop).
- Definir layout shell em `__root.tsx`: fundo preto full-height, safe areas, sem scroll horizontal.
- Atualizar meta tags: title "GF Tattoo Studio", description curta em PT, `theme-color` preto, viewport com `viewport-fit=cover`.

## 4. Internacionalização (PT / FR / EN)

Estrutura pronta, PT como padrão, sem telas traduzidas ainda:

- Instalar `i18next` + `react-i18next` + `i18next-browser-languagedetector`.
- Criar `src/i18n/index.ts` com config (fallback PT, detect via localStorage → navigator).
- Criar `src/i18n/locales/{pt,fr,en}.json` com namespace `common` (chaves iniciais: `app.name`, `app.tagline`).
- Inicializar i18n em `src/router.tsx` ou no shell raiz.

## 5. Utilitários de moeda e timezone

- `src/lib/format.ts`:
  - `formatCurrency(value)` → `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })` (ex.: `550,00 €`). Sem R$ em lugar nenhum.
  - `formatDate(date)` / `formatDateTime(date)` → `Intl.DateTimeFormat` com `timeZone: 'Europe/Brussels'`.

## 6. Tela inicial (placeholder de marca)

Substituir o placeholder em `src/routes/index.tsx` por uma landing minimalista de boas-vindas:

- Fundo preto, logo/título "GF TATTOO STUDIO" em Bebas Neue branca centralizada.
- Tagline em PT abaixo (via i18n).
- Pequeno botão vermelho desabilitado ("Em breve") só para validar tokens de cor.
- Sem navegação ainda — só prova do tema.

## 7. Metadata / SEO base

- Title: "GF Tattoo Studio"
- Description: "Estúdio de tatuagem — agendamento online"
- OG + Twitter tags coerentes
- `lang="pt"` no `<html>`

## Detalhes técnicos

- Stack: TanStack Start + Tailwind v4 + shadcn (já presente).
- Tokens via `@theme inline` mapeando variáveis em `:root` — nunca cores hardcoded em componentes.
- Fontes via `<link>` no head (Tailwind v4 não aceita `@import` remoto em CSS).
- `lang` do `<html>` fica `pt`; i18n troca apenas o conteúdo, não o atributo neste momento.
- Bibliotecas novas: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.

## Fora de escopo (próximas etapas)

- Tabelas no banco (clientes, artistas, agendamentos, pagamentos).
- Telas funcionais (auth, dashboard, agenda, perfil).
- Seletor de idioma na UI.
- Upload de logo real (uso tipográfico por enquanto).

## Confirmação final

Ao terminar, confirmo que o Lovable Cloud está conectado e mostro a tela inicial com o tema aplicado.
