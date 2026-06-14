-- Tabela para controle de episódios individuais
CREATE TABLE IF NOT EXISTS public.user_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garante que um usuário não tenha duplicadas do mesmo episódio no banco
    UNIQUE(user_id, series_id, season_number, episode_number)
);

-- Habilitar RLS (Segurança de Linha)
ALTER TABLE public.user_episodes ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can manage their own episode progress" 
ON public.user_episodes 
FOR ALL 
USING (auth.uid() = user_id);
