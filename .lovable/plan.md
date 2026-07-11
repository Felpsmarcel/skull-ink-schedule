## Diagnóstico

O cadastro está falhando porque o telefone digitado/colado contém **caracteres invisíveis de direção de texto** (U+202A / U+202C — marcadores bidi que o iOS costuma inserir automaticamente em números com "+"). O valor enviado ao GHL foi:

```
"‪+32 472 93 43 28‬"   ← há bytes invisíveis antes do "+" e no fim
```

Resposta do GHL (400):
```
"Invalid country calling code"
```

Ou seja, o "+" deixa de ser o primeiro caractere real do número, e o GHL não reconhece o código do país.

## Correção

1. **`src/lib/ghl.ts` → `createContact`** (ou helper novo `sanitizePhone`): antes de enviar, limpar o `phone`:
   - remover caracteres de controle bidi/invisíveis: `\u200B-\u200F`, `\u202A-\u202E`, `\u2066-\u2069`, `\uFEFF`
   - colapsar espaços múltiplos e dar `trim()`
   - se o número começar com `00`, converter para `+`
   
   Aplicar também ao `email` (só `trim`).

2. **`src/routes/_authenticated/appointments.new.cliente.tsx`** (`CreateContactPanel`): aplicar a mesma sanitização no `onSubmit` antes de validar, para que a validação do Zod veja o valor limpo, e para o campo mostrar exatamente o que será enviado.

3. **Mensagem de erro amigável**: quando `res.data.message === "Invalid country calling code"`, mostrar toast em PT: *"Número de telefone inválido. Verifique o código do país (ex: +32...)."* em vez de exibir o JSON cru.

## Fora do escopo

- Não mexer no fluxo de agenda, permissões, ou no edge function `ghl-proxy`.
- Nenhuma mudança de banco de dados.

## Arquivos alterados

- `src/lib/ghl.ts` — nova função `sanitizePhone` + uso em `createContact`.
- `src/routes/_authenticated/appointments.new.cliente.tsx` — sanitizar no submit e tratar erro do GHL.
