## Objetivo
Substituir o atual `gf-skull.png` (placeholder gerado) pela logo oficial da GF Tattoo em todos os pontos visíveis do app, mantendo o layout intacto.

## Variantes da logo a gerar (a partir de `src/assets/gf-logo-official.png`)

Vou recortar a logo oficial em 3 assets dedicados — a logo é monocromática (#18182E sobre branco), então basta cropar:

1. `src/assets/gf-mark.png` — apenas a **caveira central** (quadrado, ~512×512). Usado em: favicon, auth, menu (avatar fallback do header), AuthShell topbar, splash/agenda header, FAB.
2. `src/assets/gf-lockup.png` — **lockup horizontal completo** (G F + caveira + arco "TATTOO LIFESTYLE"). Usado em: tela `/auth` (acima do título), futura splash/email.
3. Manter `gf-logo-official.png` como master.

Removo `gf-skull.png` ao final (não há mais referências).

## Pontos de substituição

| Arquivo | Hoje | Depois |
|---|---|---|
| `src/components/layout/auth-shell.tsx` (TopBar desktop) | `gfSkull` 7×7 | `gfMark` 7×7 |
| `src/routes/auth.tsx` | `gfSkull` 14×14 acima do título | `gfLockup` (h-12, w-auto) — o título textual "GF Tattoo Studio" some pois o lockup já contém a marca; mantém o subtítulo "Entrar" |
| `src/routes/_authenticated/agenda.tsx` (linha 26) | `gfSkull` | `gfMark` (mesmo tamanho/posição) |
| `src/routes/_authenticated/menu.tsx` | (sem logo hoje) | adicionar `gfMark` 8×8 ao lado do título "Menu" no header sticky, para coerência visual |
| `src/components/layout/bottom-nav.tsx` FAB central | ícone `<Plus>` em círculo primary | manter botão, mas trocar o círculo para fundo branco com `gfMark` sobreposto + `<Plus>` pequeno no canto? **NÃO** — logo dentro de FAB de 56px fica ilegível. **Decisão:** manter `<Plus>` no FAB e NÃO usar a logo lá. Justifico abaixo. |
| `src/routes/__root.tsx` head | sem `<link rel="icon">` | adicionar `{ rel: "icon", type: "image/png", href: gfMarkUrl }` e atualizar `og:image`/`twitter:image` para o lockup |

### Sobre o FAB
O usuário pediu "FAB central quando aplicável". O FAB tem 56px; a caveira da logo perde legibilidade abaixo de ~40px e compete com o ícone "+". Vou **manter o `<Plus>`** e registrar isso na resposta — se preferir forçar a logo, é uma linha de código.

### Splash
Não existe rota/componente de splash dedicado hoje (o app entra direto em `/auth` ou `/agenda`). O equivalente visual é a tela `/auth`, que já recebe o lockup. Não vou inventar uma splash nova nesta task.

## Passos de implementação

1. Recortar `gf-logo-official.png`:
   - `image_tools--zoom_image` para localizar o bounding box da caveira → exportar para `src/assets/gf-mark.png`
   - segundo recorte para o lockup completo (sem padding excessivo) → `src/assets/gf-lockup.png`
2. Editar 5 arquivos acima trocando o `import` e o `<img>`.
3. Adicionar `rel="icon"` em `src/routes/__root.tsx` apontando para o asset importado (`?url`).
4. `rm src/assets/gf-skull.png` após confirmar zero referências.
5. Validar via Playwright: screenshot de `/auth` e `/agenda` em 1280×1800 + favicon presente no `<head>`.

## Fora de escopo
- Não mexer em tokens CSS, tipografia, BottomNav layout, splash dedicada, emails.
- Não substituir logo dentro de StatusBadge/EmptyState (a "marca d'água em estados vazios" mencionada na conversa anterior fica para outra task).
