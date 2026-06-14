-- Script para adicionar colunas de metadados à tabela user_movies.
-- Isso permite exibir nota e duração mesmo sem consultar a API do TMDB em tempo real.

-- 1. Adicionar coluna de nota (avaliação)
ALTER TABLE public.user_movies ADD COLUMN IF NOT EXISTS vote_average FLOAT DEFAULT 0;

-- 2. Adicionar coluna de duração (tempo em minutos)
ALTER TABLE public.user_movies ADD COLUMN IF NOT EXISTS runtime INTEGER DEFAULT 0;
