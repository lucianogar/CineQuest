import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useState, useCallback } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { tmdbService, Movie, getAiredEpisodesCount } from '@/services/tmdb';
import MovieCard from '@/components/MovieCard';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, TrendingUp } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/services/supabase';

const { height } = Dimensions.get('window');

export default function IndexScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];

  const [loading, setLoading] = useState(true);
  const [popular, setPopular] = useState<Movie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<Movie[]>([]);
  const [upcoming, setUpcoming] = useState<Movie[]>([]);
  const [popularTv, setPopularTv] = useState<Movie[]>([]);
  const [watching, setWatching] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [pop, np, up, tv] = await Promise.all([
        tmdbService.getPopular(),
        tmdbService.getNowPlaying(),
        tmdbService.getUpcoming(),
        tmdbService.getPopularTv(),
      ]);
      setPopular(pop.slice(0, 12));
      setNowPlaying(np.slice(0, 12));
      setUpcoming(up.slice(0, 12));
      setPopularTv(tv.slice(0, 12));
      
      // Buscar séries assistindo do Supabase ou AsyncStorage
      const { data: { session } } = await supabase.auth.getSession();
      
      let query = supabase
        .from('user_movies')
        .select('*')
        .in('status', ['watching', 'watched'])
        .eq('media_type', 'tv');

      if (session) {
        query = query.eq('user_id', session.user.id);
      }

      const { data: watchingData } = await query.order('added_at', { ascending: false });

      if (watchingData && watchingData.length > 0) {
        // Deduplicar por movie_id (mantendo o primeiro registro, que é o mais recente)
        const uniqueSeriesMap = new Map<number, any>();
        watchingData.forEach((item: any) => {
          if (!uniqueSeriesMap.has(item.movie_id)) {
            uniqueSeriesMap.set(item.movie_id, item);
          }
        });
        const uniqueWatchingData = Array.from(uniqueSeriesMap.values());

        const watchingWithProgress = await Promise.all(uniqueWatchingData.map(async (item) => {
          const details = await tmdbService.getTvDetails(item.movie_id);
          
          let epQuery = supabase
            .from('user_episodes')
            .select('*', { count: 'exact', head: true })
            .eq('series_id', item.movie_id);

          if (session) {
            epQuery = epQuery.eq('user_id', session.user.id);
          }

          const { count: watchedCount } = await epQuery;

          const totalAired = getAiredEpisodesCount(details);
          const totalEpisodes = totalAired > 0 ? totalAired : (details.number_of_episodes || 1);
          const count = watchedCount || 0;

          // Calcular o status correto da série com base nos episódios lançados
          let correctStatus = item.status;
          if (count > 0 && count < totalEpisodes) {
            correctStatus = 'watching';
          } else if (count >= totalEpisodes) {
            correctStatus = 'watched';
          }

          // Atualiza no banco de dados se houver divergência de status
          if (item.status !== correctStatus) {
            supabase
              .from('user_movies')
              .update({ status: correctStatus })
              .eq('id', item.id)
              .then(({ error }) => {
                if (error) console.error('Erro ao atualizar status corrigido:', error);
              });
          }

          return {
            ...item,
            status: correctStatus,
            vote_average: details.vote_average,
            media_type: 'tv',
            progress: count / totalEpisodes,
            watchedCount: count
          };
        }));

        // Exibe séries apenas se o usuário assistiu pelo menos 1 episódio e restam episódios a assistir (progress < 1)
        const filteredWatching = watchingWithProgress.filter(
          item => item.watchedCount > 0 && item.progress < 1
        );

        setWatching(filteredWatching);
      } else {
        setWatching([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do TMDB/Supabase', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const heroMovie = popular[0];
  const heroImageUrl = tmdbService.getImageUrl(heroMovie?.backdrop_path, 'original');

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Seção Hero (Filme Principal) */}
      {heroMovie && (
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: heroImageUrl || undefined }} 
            style={styles.heroImage} 
            contentFit="cover"
            transition={500}
          />
          <LinearGradient
            colors={['transparent', 'rgba(9, 9, 11, 0.6)', colors.background]}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{heroMovie.title}</Text>
              <Text style={styles.heroOverview} numberOfLines={3}>{heroMovie.overview}</Text>
              <TouchableOpacity 
                style={[styles.heroButton, { backgroundColor: colors.tint }]}
                onPress={() => router.push(`/movie/${heroMovie.id}`)}
              >
                <Play size={20} color="#FFF" fill="#FFF" />
                <Text style={styles.heroButtonText}>Detalhes</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Continuar Assistindo */}
      {watching.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Continuar Assistindo</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {watching.map(item => (
              <MovieCard 
                key={`watching-${item.id}`} 
                movie={item as any} 
                userStatus="watching"
                progress={item.progress}
                onPress={(m: any) => router.push(`/tv/${m.movie_id}`)} 
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filmes em Cartaz */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Filmes em Cartaz</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {nowPlaying.map(movie => (
            <MovieCard key={`np-${movie.id}`} movie={movie} onPress={(m: Movie) => router.push(`/movie/${m.id}`)} />
          ))}
        </ScrollView>
      </View>

      {/* Próximos Lançamentos */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximos Lançamentos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {upcoming.map(movie => (
            <MovieCard key={`up-${movie.id}`} movie={movie} onPress={(m: Movie) => router.push(`/movie/${m.id}`)} />
          ))}
        </ScrollView>
      </View>

      {/* Populares Filmes */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Filmes Populares</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {popular.slice(1).map(movie => (
            <MovieCard key={`pop-${movie.id}`} movie={movie} onPress={(m: Movie) => router.push(`/movie/${m.id}`)} />
          ))}
        </ScrollView>
      </View>

      {/* Populares Séries */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Séries em Destaque</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {popularTv.map(tv => (
            <MovieCard key={`tv-${tv.id}`} movie={tv} onPress={(m: Movie) => router.push(`/tv/${m.id}`)} />
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroContainer: {
    width: '100%',
    height: height * 0.6,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40,
  },
  heroContent: {
    gap: 10,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  heroOverview: {
    fontSize: 14,
    color: '#E4E4E7',
    lineHeight: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 10,
    gap: 8,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginTop: 20,
    paddingLeft: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  scrollContent: {
    paddingRight: 20,
    gap: 15,
  },
});
