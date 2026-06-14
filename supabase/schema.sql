-- Tabela: user_movies
-- Finalidade: Guardar a lista de filmes ou desejos de cada usuário

create table public.user_movies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  movie_id int not null, -- ID oficial do TMDB (Filme ou Série)
  title text not null, -- Título do filme ou nome da série
  poster_path text,
  release_date text, -- Data de estreia original
  location text, -- Local planejado (ex: Cinema, Casa)
  viewing_date timestamp with time zone, -- Data e Hora da sessão agendada
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('wishlist', 'watched', 'watching')) default 'wishlist',
  media_type text check (media_type in ('movie', 'tv')) default 'movie',
  unique(user_id, movie_id)
);

-- Políticas de segurança (RLS - Row Level Security)
-- Garante que o usuário logado só enxergue os SEUS próprios filmes
alter table public.user_movies enable row level security;

create policy "Usuários podem ver apenas os próprios filmes"
  on public.user_movies for select
  using ( auth.uid() = user_id );

create policy "Usuários podem inserir os próprios filmes"
  on public.user_movies for insert
  with check ( auth.uid() = user_id );

create policy "Usuários podem remover os próprios filmes"
  on public.user_movies for delete
  using ( auth.uid() = user_id );

create policy "Usuários podem atualizar os próprios filmes"
  on public.user_movies for update
  using ( auth.uid() = user_id );
-- Caso a tabela já exista, rode no SQL Editor:
-- ALTER TABLE public.user_movies ADD COLUMN location TEXT DEFAULT 'Cinema';
