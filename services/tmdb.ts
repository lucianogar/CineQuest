import axios from 'axios';

const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

const api = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
    language: 'pt-BR',
    region: 'BR',
    watch_region: 'BR',
  },
});

export const getAiredEpisodesCount = (tvShow: any): number => {
  if (!tvShow) return 0;

  // Se temos last_episode_to_air, podemos usá-lo para calcular precisamente os lançados
  if (tvShow.last_episode_to_air) {
    const lastEp = tvShow.last_episode_to_air;
    const lastSeasonNum = lastEp.season_number;
    const lastEpNum = lastEp.episode_number;

    let total = 0;
    if (tvShow.seasons) {
      for (const season of tvShow.seasons) {
        if (season.season_number <= 0) continue; // Ignora especiais

        if (season.season_number < lastSeasonNum) {
          total += season.episode_count || 0;
        } else if (season.season_number === lastSeasonNum) {
          total += lastEpNum;
        }
      }
    }
    return total;
  }

  // Se não temos last_episode_to_air, somamos os episódios de temporadas cuja data de estreia já passou
  const now = new Date();
  let total = 0;
  if (tvShow.seasons) {
    for (const season of tvShow.seasons) {
      if (season.season_number <= 0) continue; // Ignora especiais

      if (season.air_date) {
        const airDate = new Date(season.air_date);
        if (airDate <= now) {
          total += season.episode_count || 0;
        }
      }
    }
  }
  return total;
};

export interface Movie {
  id: number;
  title?: string;
  name?: string; // Para séries
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string; // Para séries
  vote_average: number;
  vote_count?: number;
  overview: string;
  genre_ids: number[];
  media_type?: 'movie' | 'tv';
  runtime?: number;
  episode_run_time?: number[];
}

export interface Genre {
  id: number;
  name: string;
}

export const tmdbService = {
  // Lançamentos no Brasil (Em breve)
  getUpcoming: async (): Promise<Movie[]> => {
    const response = await api.get('/movie/upcoming', { params: { region: 'BR' } });
    return response.data.results.map((m: any) => ({ ...m, media_type: 'movie' }));
  },

  // Populares no momento
  getPopular: async (): Promise<Movie[]> => {
    const response = await api.get('/movie/popular', { params: { region: 'BR' } });
    return response.data.results.map((m: any) => ({ ...m, media_type: 'movie' }));
  },

  // Em cartaz no Brasil
  getNowPlaying: async (): Promise<Movie[]> => {
    const response = await api.get('/movie/now_playing', { params: { region: 'BR' } });
    return response.data.results.map((m: any) => ({ ...m, media_type: 'movie' }));
  },

  // Busca unificada (filmes e séries)
  searchMulti: async (query: string): Promise<Movie[]> => {
    const response = await api.get('/search/multi', {
      params: { query },
    });
    // Filtramos para retornar apenas filmes e séries (ignorando pessoas)
    return response.data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
  },

  // Busca de filmes (legacy/específica)
  searchMovies: async (query: string): Promise<Movie[]> => {
    const response = await api.get('/search/movie', {
      params: { query },
    });
    return response.data.results.map((m: any) => ({ ...m, media_type: 'movie' }));
  },

  // Detalhes completos do filme
  getMovieDetails: async (id: number) => {
    const response = await api.get(`/movie/${id}`, {
      params: {
        append_to_response: 'credits,videos,reviews,release_dates,similar,recommendations,watch/providers',
      },
    });
    return { ...response.data, media_type: 'movie' };
  },

  // Detalhes completos da série
  getTvDetails: async (id: number) => {
    const response = await api.get(`/tv/${id}`, {
      params: {
        append_to_response: 'credits,aggregate_credits,videos,similar,recommendations,reviews,watch/providers',
      },
    });
    return { ...response.data, media_type: 'tv' };
  },

  // Retorna a URL completa da imagem
  getImageUrl: (path: string | null, size: 'w500' | 'original' = 'w500') => {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },

  // Busca detalhes de um ator
  getActorDetails: async (id: number) => {
    const response = await api.get(`/person/${id}`, {
      params: {
        append_to_response: 'combined_credits',
      },
    });
    return response.data;
  },

  // Busca uma empresa produtora pelo nome
  searchCompanies: async (query: string) => {
    const response = await api.get('/search/company', {
      params: { query },
    });
    return response.data.results;
  },

  // Descoberta de filmes
  discoverMovies: async (params: any): Promise<Movie[]> => {
    const response = await api.get('/discover/movie', {
      params: {
        ...params,
        include_adult: false,
      },
    });
    return response.data.results.map((m: any) => ({ ...m, media_type: 'movie' }));
  },

  // Séries populares
  getPopularTv: async (): Promise<Movie[]> => {
    const response = await api.get('/tv/popular', { params: { region: 'BR' } });
    return response.data.results.map((t: any) => ({ ...t, media_type: 'tv' }));
  },

  // Descoberta de séries
  discoverTv: async (params: any = {}): Promise<Movie[]> => {
    const response = await api.get('/discover/tv', {
      params: {
        ...params,
        include_adult: false,
      },
    });
    return response.data.results.map((t: any) => ({ ...t, media_type: 'tv' }));
  },

  // Lista de gêneros de filmes
  getMovieGenres: async (): Promise<Genre[]> => {
    const response = await api.get('/genre/movie/list');
    return response.data.genres;
  },

  // Lista de gêneros de séries
  getTvGenres: async (): Promise<Genre[]> => {
    const response = await api.get('/genre/tv/list');
    return response.data.genres;
  },

  // Detalhes da temporada (episódios)
  getTvSeason: async (seriesId: number, seasonNumber: number) => {
    const response = await api.get(`/tv/${seriesId}/season/${seasonNumber}`);
    return response.data;
  },

  // Detalhes da coleção (franquia de filmes)
  getCollectionDetail: async (collectionId: number) => {
    const response = await api.get(`/collection/${collectionId}`);
    return response.data;
  },
};
