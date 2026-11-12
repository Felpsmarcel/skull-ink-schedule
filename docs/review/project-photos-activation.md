# Fotos do projeto — galeria e preparação de ativação

## Estado desta entrega

A ficha contém a galeria de projeto. `ProjectPhotosGallery` é o componente real reutilizável: seleção de arquivo, revisão da imagem, tipo (referência/antes/progresso/resultado), legenda, ampliação acessível, confirmação de remoção e estados de carga, erro, sem acesso e sem fotos. Upload/remoção só mudam a lista após resultado do adapter confirmado por ID e projeto. A demonstração informa expressamente que suas alterações são locais.

O rascunho é isolado por `projectId` em memória. Fechar a revisão preserva arquivo e legenda para aquele projeto enquanto o componente estiver montado; descarte, recarregamento ou saída da ficha eliminam o rascunho. Nenhuma foto é salva em localStorage. A prévia usa object URLs revogados ao trocar/descartar arquivo.

**Persistência remota de fotos ainda não está implementada nem ativada.** O adapter vivo oferece somente a consulta de disponibilidade: autentica o usuário, verifica papel e projeto por ID e retorna `disabled`. Nenhum arquivo, metadado ou URL de foto é buscado. Não há endpoint vivo de upload/delete, nem flag que possa tornar essa funcionalidade operacional por acidente. Esta entrega não transforma `checkins.photo_url` em galeria de projeto.

## Contrato do adapter

`ProjectPhotosAdapter` em `src/lib/project-photos-adapter.ts`:

- `load(projectId)` retorna disabled, forbidden ou ready; ready inclui fotos e permissões de envio/remoção.
- `upload({projectId,file,kind,caption,requestId})` deve devolver `{photo}` apenas após persistência confirmada.
- `remove({projectId,photoId,requestId})` deve devolver `{removedPhotoId}` apenas após remoção confirmada.
- Foto: ID imutável, projectId, URL autorizada temporária, tipo, legenda e data de inclusão registrada.
- A chave de upload permanece estável no retry sem alteração do rascunho. Mudanças no arquivo ou metadados geram outra chave. Repetição não deve duplicar arquivo/metadado.

## Preparação concreta de banco

`docs/sql/project-photos.review.sql` é SQL de revisão, **não migration aplicada**. Cria:

- `project_photos` ligada a `tattoo_projects`, autoria por app_user, tipos e tamanhos limitados, chave idempotente e caminho obrigatório `projectId/photoId`;
- bucket privado `project-photos-private`, JPG/PNG/WebP até 10 MB;
- SELECT por RLS restrito a admin ou artista cuja identidade verificada coincide com `tattoo_projects.artist_id`;
- acesso ao objeto somente quando existe metadado autorizado com caminho exato;
- metadados sem permissão de escrita direta por authenticated/anon, inclusive admin. Escrita fica reservada ao serviço que revalidará autorização a cada ação.

PGlite efêmero em `tests/unit/project-photos-sql.test.ts` verifica admin, dois artistas distintos, projeto sem artista, vendedor, artista sem vínculo, identidade ausente, objeto órfão, outro bucket, privacidade e bloqueio de mutações diretas. Isso não comprova políticas existentes ou comportamento do Supabase Storage real.

## Ordem necessária para ativação em staging

1. Conferir projeto e banco de staging. Inventariar TODAS as políticas de `storage.objects`, grants e funções vigentes: políticas permissivas se combinam por OR. Não aplicar este SQL enquanto uma política abrangente puder expor o bucket.
2. Revisar e incorporar o SQL pelo fluxo de migrations. Confirmar bucket privado e limites existentes; conflito de nome não deve alterar um bucket desconhecido. `ON CONFLICT` não repara limites antigos automaticamente.
3. Implementar handlers autenticados de lista paginada, upload e remoção. Introduzir flag de servidor desligada por padrão. Validar papel admin/artist, vínculo artist_id e project_id em cada operação, sem aceitar papel, criador, caminho ou identidade do cliente. Não basta confiar na capacidade enviada ao navegador.
4. Validar conteúdo binário real e dimensões; rejeitar MIME disfarçado e payload além do limite. Não enviar um arquivo apenas porque o navegador declarou `image/*`. Definir consentimento e retenção de fotos com a gestão antes de permitir envio.
5. Guardar arquivos em bucket privado e gerar URLs assinadas de curta duração somente após leitura autorizada. Não usar URLs públicas. Definir revogação e prazo para fotos removidas; uma URL assinada existente pode continuar válida até expirar.
6. Persistir metadado e objeto com idempotência; transações SQL não abrangem o Storage. Implementar estados e compensação de uploads órfãos, auditoria de remoção e reconciliação de falhas parciais antes de retornar sucesso. Não expor uma linha sem arquivo confirmado nem declarar remoção concluída prematuramente.
7. Homologar com admin e dois artistas de teste: projeto próprio, projeto alheio por URL/ID adulterado, ausência de vínculo, retry, upload duplicado, falha de rede, delete em repetição, imagem expirada, paginação e revogação após troca de artista.
8. Conectar adapter vivo à galeria e ativar somente após essa homologação. O acesso do artista ao painel administrativo continua bloqueado; a galeria não amplia outras permissões.

Nenhuma migration, bucket, imagem de cliente ou política de produção foi criada ou alterada nesta revisão.
