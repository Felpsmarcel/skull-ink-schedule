## Plano

Corrigir a tela em branco ao acessar `/admin/movimentacao-links` e deixar o comportamento claro para contas não-admin.

### Diagnóstico confirmado

- O preview atual está em `/onboarding/bem-vindo` com `body` vazio e sem overlay de erro visível.
- A sessão atual retorna perfil `artist`, não `admin`.
- A rota admin já tem uma tela de “Acesso restrito”, mas o app ainda pode cair no onboarding antes de renderizar algo útil.
- O onboarding chama `getOnboardingStatus()` em `beforeLoad`; se essa chamada falhar ou travar, a página pode ficar sem conteúdo visível.

### Implementação proposta

1. **Blindar o gate principal autenticado**
   - Manter `/admin/*` fora do redirecionamento obrigatório para onboarding.
   - Fazer a verificação do usuário por uma função reutilizável para evitar divergência entre rota e UI.

2. **Corrigir fallback do onboarding**
   - Adicionar `pendingComponent`/estado de carregamento no layout de onboarding.
   - Adicionar `errorComponent` simples para que falhas no `getOnboardingStatus()` não resultem em tela branca.

3. **Melhorar a autorização admin**
   - Garantir que `/admin/movimentacao-links` sempre renderize uma destas opções:
     - página admin completa quando a conta for admin;
     - “Acesso restrito” quando a conta for artista/vendedor;
     - erro amigável com botão de tentar novamente se o perfil falhar.

4. **Validar no preview**
   - Reabrir `/admin/movimentacao-links` com a sessão atual.
   - Confirmar que não fica em branco e que a mensagem correta aparece para `artist`.
   - Conferir logs/console para garantir ausência de erro runtime.

### Resultado esperado

Ao acessar `/admin/movimentacao-links`, a tela não deve mais ficar branca. Se a conta atual não for admin, o app deve mostrar claramente “Acesso restrito” em vez de redirecionar silenciosamente para onboarding ou renderizar vazio.