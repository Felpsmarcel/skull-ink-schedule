
# Proxy GHL — Edge Function `ghl-proxy` + teste de free-slots

## O que vou construir

### 1. Edge Function `ghl-proxy` (Supabase / Lovable Cloud)

Arquivo: `supabase/functions/ghl-proxy/index.ts`

Comportamento:
- Recebe `POST` do frontend com JSON `{ path, method?, query?, body?, version? }`.
- Lê `GHL_TOKEN` de `Deno.env`.
- Faz `fetch` para `https://services.leadconnectorhq.com{path}` com:
  - `Authorization: Bearer ${GHL_TOKEN}`
  - `Version: <version || "2021-04-15">` (header obrigatório da API do GHL; usaremos `2021-04-15` para Calendars)
  - `Accept: application/json`
  - `Content-Type: application/json` quando houver body
- Repassa `query` como querystring e devolve `status + body` exatamente como o GHL respondeu.
- Headers CORS abertos (`*`) com `OPTIONS` handler — necessário porque o navegador chama a function.
- Em erro de rede/falta de token: retorna `{ error, detail }` com status apropriado.
- Sem auth obrigatória no proxy nesta fase de teste (será adicionada depois junto com login). Anotado como TODO para a próxima etapa.

### 2. Cliente no frontend

Arquivo novo: `src/lib/ghl.ts`
- `ghlFetch({ path, method, query, body, version })` → chama `supabase.functions.invoke("ghl-proxy", { body: ... })` e devolve `{ status, data }`.

### 3. Tela de teste

Rota nova: `src/routes/ghl-test.tsx` (link na home temporário)
- Botão "Buscar free-slots — Randevu (hoje → +7 dias)".
- Ao clicar, chama:
  - `path`: `/calendars/NzAYeRNJnvfpu7ynyoEK/free-slots`
  - `query`:
    - `startDate`: timestamp em ms de hoje 00:00 (Europe/Brussels)
    - `endDate`: timestamp em ms de hoje + 7 dias 23:59 (Europe/Brussels)
    - `timezone`: `Europe/Brussels`
    - `locationId`: `9iqrKUVPDddINb9S4Iwd`
  - `version`: `2021-04-15`
- Mostra `status` + JSON bruto em um `<pre>` com `JSON.stringify(data, null, 2)` para você confirmar o dado real.
- Mostra mensagem de erro se vier 4xx/5xx, incluindo o corpo retornado pelo GHL.

## O que preciso de você

**Apenas o `GHL_TOKEN`.**

Depois que você aprovar este plano, vou pedir o token via formulário seguro do Lovable (tool `add_secret`). Você vai ver um campo para colar o token — **não cole o token aqui no chat**. O token fica guardado no backend como variável de ambiente, acessível só pela edge function. Nunca toca o frontend.

Onde pegar o token no GHL: Settings → Private Integrations → criar token com o scope `calendars.readonly` (mínimo para este teste; podemos ampliar depois para agendamentos, contatos, etc.).

## Fora de escopo desta etapa

- Autenticação no proxy (vem junto com o login do app).
- Cache, retry, rate limiting.
- Endpoints além do free-slots — só o teste pedido.

## Nota técnica

Este projeto é TanStack Start; normalmente o padrão recomendado seria um server route/function do TanStack. Mas, como você pediu explicitamente edge function do Supabase, vou nesse caminho — funciona igualmente bem, mantém o token só no servidor e elimina o CORS. Se preferir o padrão TanStack depois, é trivial migrar.
