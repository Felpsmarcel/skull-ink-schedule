# Ficha sintética local

Execute na raiz do repositório:

```sh
node node_modules/vite/bin/vite.js --config tests/visual/vite.config.ts
```

Abra http://127.0.0.1:8784/. O harness usa os componentes reais da ficha com dados fictícios. Não lê arquivos de ambiente; funções de servidor são substituídas por stubs que rejeitam chamadas. Os vínculos simulados somem ao recarregar. Não é uma rota do app nem uma homologação da integração GHL.

Checklist manual: selecionar oportunidade divergente, verificar bloqueio de confirmação, cancelar/reabrir, confirmar preservação do contrato, verificar bloqueio de repetição, recarregar e conferir descarte. Repetir em 393 × 852 e 1280 × 900. Escape deve fechar o diálogo e devolver foco ao botão de abertura.
