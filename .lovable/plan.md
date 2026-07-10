# Blindagem do fluxo de convite ao tatuador

## Problema

O tatuador que você convidou caiu na tela de onboarding do `lovable.dev` porque o convite foi enviado a partir do **preview do editor**. O `redirectTo` usa `window.location.origin` do admin, então o link do email apontou para o domínio errado.

## Objetivo

1. Nunca mais gerar convite com link de preview.
2. Permitir reenviar o convite com 1 clique.
3. Deixar o email branded (`team-welcome`) claro sobre o próximo passo.

---

## Mudanças

### 1. Forçar domínio de produção no `redirectTo` (backend)

**`src/lib/team.functions.ts` — `inviteArtist`**

- Ignorar o `redirectTo` recebido do cliente (que pode ser preview).
- Hardcode do domínio final: `https://gftattoocalendar.com/auth/update-password`.
- Manter o parâmetro `redirectTo` no schema por compatibilidade, mas sobrescrever antes de chamar `inviteUserByEmail`.

Assim, mesmo convidando do preview do Lovable, o email sai apontando para o domínio real.

### 2. Botão "Reenviar convite" (frontend)

**`src/components/…` / `src/routes/_authenticated/_admin/admin.equipe.tsx`**

No card de cada artista:

- Se o artista **já tem** um usuário vinculado, o botão "Convidar" hoje vira "Reenviar" mas usa o mesmo email do input.
- Adicionar tratamento explícito: se o Supabase responder "email already registered", em vez de mostrar erro genérico, chamar automaticamente `resend` do Supabase para gerar novo link de invite (`supabase.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } })`).
- Toast de sucesso: "Novo link de convite enviado para <email>."

### 3. Melhorar o email `team-welcome`

**`src/lib/email-templates/team-welcome.tsx`**

Hoje o email só dá boas-vindas. Adicionar:

- Bloco destacando **"Confira o outro email com o assunto 'You've been invited' para definir sua senha e entrar."**
- CTA secundário para `/auth` caso ele já tenha definido senha por outro caminho.
- Manter o tom minimalista atual, sem promoções.

### 4. (Opcional, incluído) — Página `/auth/update-password` mais resiliente

Se o link vier expirado ou já usado, mostrar CTA direto para "Esqueci minha senha" (já existe, mas reforçar copy: "Peça um novo link, ele chega no seu email em segundos.").

---

## Fora de escopo (proponho depois se quiser)

- Prevenir duplicação de usuário quando o tatuador entrar por Google antes de aceitar o convite.
- Botão "Copiar link de convite" (útil para enviar por WhatsApp em vez de email).
- Painel de "convites pendentes" com data de envio e status (aceito / expirado).

---

## Detalhes técnicos

- Nenhuma migração de banco necessária.
- Sem alteração em RLS.
- `PROD_ORIGIN` fica hardcoded no server (`src/lib/team.functions.ts`). Se um dia trocar de domínio, é 1 linha para atualizar.
- O caminho `/auth/update-password` já existe e trata `type=invite` corretamente via `verifyOtp`.

---

## Como testar

1. Abrir `/admin/equipe` **dentro do preview do Lovable**.
2. Convidar um email de teste.
3. Conferir no email recebido que o link começa com `https://gftattoocalendar.com/`.
4. Clicar → deve cair em `/auth/update-password` do domínio real, com o form de nova senha.
5. Definir senha → cair em `/agenda`.
6. Voltar em `/admin/equipe`, clicar "Reenviar" no mesmo artista → novo email chega.