
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_max_eur numeric(8,2) DEFAULT NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description_short text DEFAULT NULL;

TRUNCATE public.services RESTART IDENTITY CASCADE;

INSERT INTO public.services
  (name, category, duration_min, modality, price_eur, price_max_eur, description_short, sort_order, active)
VALUES
  ('Fine Line Simples', 'Tatuagem Pequena / Fine Line', 60, 'presencial', 100.00, 100.00, 'Traço fino, desenho pequeno e pouco detalhe', 1, true),
  ('Mini Tattoo Personalizada', 'Tatuagem Pequena / Fine Line', 90, 'presencial', 150.00, 250.00, 'Símbolos, nomes, datas ou desenho pequeno exclusivo', 2, true),
  ('Tatuagem Pequena com Sombra', 'Tatuagem Pequena / Fine Line', 120, 'presencial', 250.00, 400.00, 'Pequena tattoo com leve sombreamento ou detalhe extra', 3, true),
  ('Pequena Realista', 'Tatuagem Pequena / Fine Line', 150, 'presencial', 400.00, 600.00, 'Pequena peça com mais detalhe, textura ou mini realismo', 4, true),
  ('Tattoo Média Simples', 'Tatuagem Média', 180, 'presencial', 500.00, 700.00, 'Desenho médio com traço, sombra leve ou composição limpa', 5, true),
  ('Tattoo Média Realista', 'Tatuagem Média', 240, 'presencial', 700.00, 1000.00, 'Realismo preto e cinza ou colorido com mais detalhe', 6, true),
  ('Tattoo Média Premium', 'Tatuagem Média', 300, 'presencial', 1000.00, 1500.00, 'Projeto autoral, composição personalizada e acabamento avançado', 7, true),
  ('Projeto Médio com Artista Especialista', 'Tatuagem Média', 300, 'presencial', 1500.00, 2000.00, 'Peça média com artista de alto nível ou convidado', 8, true),
  ('Tattoo Grande 1 Sessão', 'Tatuagem Grande', 300, 'presencial', 1200.00, 1800.00, 'Projeto grande com execução em uma sessão', 9, true),
  ('Realismo Grande Premium', 'Tatuagem Grande', 300, 'presencial', 1800.00, 2300.00, 'Peça grande com alto nível de detalhe e acabamento', 10, true),
  ('Projeto Grande Autoral', 'Tatuagem Grande', 360, 'presencial', 2300.00, 2700.00, 'Criação exclusiva com estudo de referência e composição personalizada', 11, true),
  ('Sessão Premium GF / Guest Artist', 'Tatuagem Grande', 360, 'presencial', 2700.00, 3000.00, 'Sessão de alto padrão com artista premium ou convidado especial', 12, true),
  ('Cover Pequeno Simples', 'Cobertura Básica', 120, 'presencial', 300.00, 500.00, 'Cobertura de nome, símbolo ou desenho pequeno', 13, true),
  ('Cover Fine Line / Blackwork Leve', 'Cobertura Básica', 150, 'presencial', 500.00, 700.00, 'Cobertura com desenho estratégico e traços mais definidos', 14, true),
  ('Cover com Sombra', 'Cobertura Básica', 180, 'presencial', 700.00, 900.00, 'Cobertura usando sombra, contraste e desenho adaptado', 15, true),
  ('Cover Pequeno Premium', 'Cobertura Básica', 210, 'presencial', 900.00, 1200.00, 'Cobertura pequena com projeto mais elaborado e acabamento superior', 16, true),
  ('Cover Médio Estratégico', 'Cobertura Média', 240, 'presencial', 900.00, 1200.00, 'Cobertura média com nova composição sobre tattoo antiga', 17, true),
  ('Cover Médio Realista', 'Cobertura Média', 300, 'presencial', 1200.00, 1600.00, 'Cobertura com realismo, sombras e maior profundidade', 18, true),
  ('Cover Médio Colorido', 'Cobertura Média', 300, 'presencial', 1500.00, 2000.00, 'Cobertura com cores, contraste e reconstrução visual', 19, true),
  ('Cover Médio Premium', 'Cobertura Média', 360, 'presencial', 2000.00, 2400.00, 'Projeto exclusivo para transformar a tattoo antiga em peça artística', 20, true),
  ('Cover Complexo Parcial', 'Cobertura Complexa', 300, 'presencial', 1800.00, 2300.00, 'Cobertura de área difícil com estudo de desenho e contraste', 21, true),
  ('Cover Realista Avançado', 'Cobertura Complexa', 360, 'presencial', 2300.00, 2700.00, 'Cobertura com alto nível de técnica, sombra, textura e profundidade', 22, true),
  ('Cover de Cover', 'Cobertura Complexa', 360, 'presencial', 2500.00, 3000.00, 'Para tatuagens já cobertas anteriormente ou muito escuras', 23, true),
  ('Projeto Premium de Cobertura', 'Cobertura Complexa', 420, 'presencial', 3000.00, 3000.00, 'Sessão premium para transformação completa da tatuagem antiga', 24, true);
