-- Atualiza a restrição de status para permitir 'watching' (Assistindo)
ALTER TABLE public.user_movies DROP CONSTRAINT IF EXISTS user_movies_status_check;
ALTER TABLE public.user_movies ADD CONSTRAINT user_movies_status_check CHECK (status IN ('wishlist', 'watched', 'watching'));
