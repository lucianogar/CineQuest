-- Comando para remover a restrição que proibe o mesmo filme de ser marcado como assistido mais de uma vez.
-- Isso permite o rastreamento de múltiplas sessões (histórico completo).

-- 1. Remover a restrição de unicidade antiga (composite key)
ALTER TABLE public.user_movies DROP CONSTRAINT IF EXISTS user_movies_user_id_movie_id_key;

-- [OPCIONAL] Se desejar garantir que não fiquem 'exatamente' iguais no mesmo segundo (redundante):
-- CREATE UNIQUE INDEX IF NOT EXISTS user_movies_session_unique_idx ON public.user_movies (user_id, movie_id, added_at);
