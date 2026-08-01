## Objetivo
No formulário de **Registrar pagamento** (`/movimentacao/<link>` e o lançamento manual do admin):
1. "Recebido por" passa a ter **André** e **Joyce** (hoje só Gabriel, Nívia, Augusto).
2. "Quem está a registar?" passa a ter as mesmas opções (usa a mesma lista).
3. "Tatuador" passa a incluir **Nívia**.

## 1. André e Joyce como recebedores/registadores
A lista fechada de staff vive em `src/config/movimentacao-slugs.ts` (`STAFF_RECEBEDORES`), ligada às contas reais da plataforma. Vou acrescentar duas entradas com os utilizadores já existentes:
- André Pareyn → conta `8d2b3fe0-…`
- Joyce Cavalcante → conta `e638e244-…`

Como "Recebido por" e "Quem está a registar?" leem a mesma lista, ambos os seletores ganham as duas opções de uma vez, e a validação no servidor aceita os novos valores automaticamente. Os nomes também passam a aparecer corretamente no relatório de pagamentos.

Ordem sugerida no seletor: Gabriel, Nívia, Augusto, André, Joyce (mantém o hábito atual de quem usa mais).

## 2. Nívia na lista de tatuadores
O seletor "Tatuador" lista os artistas ativos do cadastro. Hoje a Nívia existe apenas como **vendedora**, por isso não aparece. Para ela poder ser escolhida como quem fez o trabalho, crio um registo de tatuadora "Nívia" (ativa, comissão 0% por omissão) — a ficha de vendedora continua intacta e os links/comissões de venda dela não mudam.

Nota: a partir daí, lançamentos com Nívia como tatuadora vão aparecer nos relatórios por tatuador com o nome dela.

## Notas técnicas
- `src/config/movimentacao-slugs.ts`: adicionar `andre` e `joyce` a `StaffRecebedorId`, `STAFF_RECEBEDORES` e `STAFF_RECEBEDOR_IDS`.
- Nada a mudar em `movimentacao.functions.ts` nem no formulário: ambos derivam da mesma constante (Zod usa `STAFF_RECEBEDOR_IDS`).
- Migração/inserção de dados: nova linha em `artists` com nome "Nívia", `active = true`.
- Validar com `tsgo` e um build de produção.
