## Liberar largura do shell em telas grandes

Mudança única e segura em `src/routes/__root.tsx`, linha 141.

### Antes
```tsx
<div className="mx-auto w-full max-w-md min-h-dvh">
```

### Depois
```tsx
<div className="mx-auto w-full max-w-md sm:max-w-3xl lg:max-w-6xl min-h-dvh">
```

### Por que isso é seguro
- **Mobile (<640px)** continua em `max-w-md` (28rem) → idêntico ao atual.
- **Tablet (≥640px)** sobe para `max-w-3xl` (48rem).
- **Desktop (≥1024px)** sobe para `max-w-6xl` (72rem) → agenda e financeiro passam a ocupar mais espaço.
- **Auth** (`src/routes/auth.tsx`) já se auto-constrange com `max-w-sm` interno → continua compacto e centralizado.
- **Menu, Services, Reviews, Appointments/new, Checkout** já têm `max-w-md` internos → permanecem compactos mesmo com o shell mais largo.
- **Agenda e Financeiro** não têm `max-w-md` interno → ganham largura automaticamente em tablet/desktop.
- **BottomNav** já é `fixed` com `max-w-md` próprio → segue como faixa central estilo mobile, sem afetar o conteúdo.

### Overflow horizontal
Sem novas regras de largura fixa. O shell mantém `w-full` + `mx-auto`, então não introduz overflow. Nada a tocar em `src/styles.css`.

### Fora de escopo
- Sem sidebar.
- Sem redesign de agenda/financeiro.
- Sem mudanças em rotas, server functions, GHL, Supabase, migrations.
