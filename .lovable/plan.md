## Objetivo

Substituir o ícone do app (o que aparece ao adicionar à tela inicial no iPhone/Android e também favicon) pela nova imagem enviada (caveira dourada sobre fundo preto).

## Alterações

Gerar a partir da imagem `user-uploads://66A04802-6A95-4981-9D92-59C47A6C4123.png` (1254×1254) e sobrescrever, com fundo preto opaco (sem transparência para o iOS renderizar corretamente):

1. `public/icons/icon-192.png` — 192×192
2. `public/icons/icon-512.png` — 512×512
3. `public/icons/icon-maskable-512.png` — 512×512 com safe zone (padding ~10% para o recorte maskable do Android)
4. `public/apple-touch-icon.png` — 180×180 (usado pelo iOS ao "Adicionar à tela inicial")
5. `public/favicon-32.png` — 32×32
6. `public/favicon.ico` — 32×32

Nenhuma mudança em código/manifest — os caminhos já referenciam esses arquivos. Só troca de assets.

## Notas técnicas

- Uso Pillow (Python) para redimensionar e achatar sobre fundo `#0A0A0A` (mesmo `background_color` do manifest).
- Para o iOS, o `apple-touch-icon.png` NÃO deve ter transparência — o iOS aplica o próprio arredondamento.
- Após a troca, o usuário pode precisar remover o ícone antigo da tela inicial e re-adicionar para o iOS invalidar o cache.
