import CustomModal from '@/components/CustomModal';
import MovieCard from '@/components/MovieCard';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/services/supabase';
import { tmdbService } from '@/services/tmdb';
import { openWatchProvider } from '@/services/watchProviders';
import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform as RNPlatform, Linking, Share } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, CalendarDays, CalendarPlus, Clock, Library, MapPin, Star, Trash2, Tv, Play, MessageSquareText, Video, Newspaper, Share2 } from 'lucide-react-native';
import * as Calendar from 'expo-calendar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { requestNotificationPermissions, scheduleMovieAlerts, cancelMovieAlerts } from '@/services/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpandableText } from '@/components/ui/ExpandableText';

const { height } = Dimensions.get('window');

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [movie, setMovie] = useState<any>(null);
  const [collectionMovies, setCollectionMovies] = useState<any[]>([]);
  const [digitalDate, setDigitalDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMovieStatus, setUserMovieStatus] = useState<'wishlist' | 'watched' | null>(null);
  const [userMovieLocation, setUserMovieLocation] = useState<string | null>(null);
  const [userMovieViewingDate, setUserMovieViewingDate] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Estados do Seletor de Data/Hora
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [editingSession, setEditingSession] = useState<any>(null);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'wishlist' | 'watched' | null>(null);

  // Estados do Modal
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    buttons: { text: string; onPress: () => void; primary?: boolean; destructive?: boolean; }[];
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showModal = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info', buttons?: any[]) => {
    setModalConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK', onPress: () => {}, primary: true }],
    });
  };

  const loadUserData = async () => {
    if (!id) return;
    
    let query = supabase.from('user_movies').select('*');
    if (session) {
      query = query.eq('user_id', session.user.id);
    }
    
    // Buscar status atual (mais recente) e histórico
    const { data: userMovieData, error } = await query
      .eq('movie_id', Number(id))
      .order('added_at', { ascending: false });

    if (!error && userMovieData) {
      const wishlistEntry = userMovieData.find((m: any) => m.status === 'wishlist');
      const watchedEntries = userMovieData.filter((m: any) => m.status === 'watched');
      
      setUserMovieStatus(wishlistEntry ? 'wishlist' : (watchedEntries.length > 0 ? 'watched' : null));
      setUserMovieLocation(wishlistEntry?.location || null);
      setUserMovieViewingDate(wishlistEntry?.viewing_date || null);
      setHistory(watchedEntries);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  useEffect(() => {
    async function loadAllData() {
      if (!id) return;
      
      try {
        // BUSCA PARALELA: Detalhes do filme e Dados do usuário ao mesmo tempo
        const moviePromise = tmdbService.getMovieDetails(Number(id));
        
        let userQuery = supabase.from('user_movies').select('*');
        if (session) {
          userQuery = userQuery.eq('user_id', session.user.id);
        }
        const userPromise = userQuery.eq('movie_id', Number(id)).order('added_at', { ascending: false });

        const [movieData, userRes] = await Promise.all([moviePromise, userPromise]);

        // 1. Processar dados do Filme
        // 1.1 Filtrar conteúdos que o usuário já assistiu (exceto Coleção) antes de setar o estado
        await filterWatchedContent(movieData);
        setMovie(movieData);
        
        // 1.2 Buscar Coleção se existir (NÃO filtramos assistidos aqui para ver a saga completa)
        if (movieData.belongs_to_collection) {
          try {
            const collectionData = await tmdbService.getCollectionDetail(movieData.belongs_to_collection.id);
            if (collectionData && collectionData.parts) {
              // Filtrar o filme atual e ordenar por data de lançamento
              const parts = collectionData.parts
                .filter((m: any) => m.id !== Number(id))
                .sort((a: any, b: any) => {
                  const dateA = a.release_date || '9999';
                  const dateB = b.release_date || '9999';
                  return dateA.localeCompare(dateB);
                });
              setCollectionMovies(parts);
            }
          } catch (collErr) {
            console.error('Erro ao carregar coleção:', collErr);
          }
        }

        const brReleases = movieData.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'BR');
        const digitalRelease = brReleases?.release_dates?.find((rd: any) => rd.type === 4 || rd.type === 6);
        
        if (digitalRelease) {
          setDigitalDate(digitalRelease.release_date);
        } else {
          const usReleases = movieData.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
          const usDigital = usReleases?.release_dates?.find((rd: any) => rd.type === 4 || rd.type === 6);
          if (usDigital) setDigitalDate(usDigital.release_date);
        }

        // 2. Processar dados do Usuário (Sincronizado)
        if (userRes && userRes.data) {
          const wishlistEntry = userRes.data.find((m: any) => m.status === 'wishlist');
          const watchedEntries = userRes.data.filter((m: any) => m.status === 'watched');
          
          setUserMovieStatus(wishlistEntry ? 'wishlist' : (watchedEntries.length > 0 ? 'watched' : null));
          setUserMovieLocation(wishlistEntry?.location || null);
          setUserMovieViewingDate(wishlistEntry?.viewing_date || null);
          setHistory(watchedEntries);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }

    async function filterWatchedContent(movieData: any) {
      if (!movieData) return;

      try {
        // 1. Coletar IDs das recomendações e similares
        const recIds = movieData.recommendations?.results?.map((m: any) => m.id) || [];
        const simIds = movieData.similar?.results?.map((m: any) => m.id) || [];
        const allRecommendedIds = [...new Set([...recIds, ...simIds])];

        if (allRecommendedIds.length === 0) return;

        // 2. Consultar quais desses IDs o usuário já assistiu
        let query = supabase.from('user_movies').select('movie_id');
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        const { data: watchedData } = await query
          .in('movie_id', allRecommendedIds)
          .eq('status', 'watched');

        if (watchedData && watchedData.length > 0) {
          const watchedIds = new Set(watchedData.map((w: any) => w.movie_id));

          // 3. Filtrar os resultados originais (Não filtramos a Coleção, apenas Sugeridos e Similares)
          if (movieData.recommendations?.results) {
             movieData.recommendations.results = movieData.recommendations.results.filter(
               (m: any) => !watchedIds.has(m.id)
             );
          }
          if (movieData.similar?.results) {
             movieData.similar.results = movieData.similar.results.filter(
               (m: any) => !watchedIds.has(m.id)
             );
          }
          
          // Forçar atualização do estado do filme para refletir as listas filtradas
          setMovie({ ...movieData });
        }
      } catch (e) {
        console.error('Erro ao filtrar conteúdos assistidos:', e);
      }
    }

    loadAllData();
  }, [id, session]);

  const recommendationsSection = useMemo(() => {
    if (!movie?.recommendations?.results || movie.recommendations.results.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sugerido para Você</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {movie.recommendations.results.slice(0, 15).map((m: any) => (
            <MovieCard 
              key={m.id} 
              movie={{ ...m, media_type: 'movie' }}
              onPress={() => router.push(`/movie/${m.id}`)}
              width={140}
            />
          ))}
        </ScrollView>
      </View>
    );
  }, [movie?.recommendations?.results, colors]);

  const handleHistoryDateChange = async (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate || !editingSession) {
      setEditingSession(null);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('user_movies')
        .update({ added_at: selectedDate.toISOString() })
        .eq('id', editingSession.id);
        
      if (!error) {
        await loadUserData();
        showModal('Sucesso', 'Data da sessão atualizada!', 'success');
      }
    } catch (err) {
      showModal('Erro', 'Não foi possível atualizar a data.', 'error');
    }
    setEditingSession(null);
  };

  const markAsWatched = async (forceAdd = false) => {

    // Se já foi assistido e não estamos forçando uma nova adição, perguntamos
    if (history.length > 0 && !forceAdd) {
      showModal('Filme já assistido', `Você já assistiu este filme ${history.length}x. O que deseja fazer?`, 'info', [
        { text: 'Assistir Novamente (+1)', onPress: () => { setModalConfig(prev => ({ ...prev, visible: false })); markAsWatched(true); }, primary: true },
        { text: 'Remover Última Sessão', onPress: () => { setModalConfig(prev => ({ ...prev, visible: false })); removeLastSession(); }, destructive: true },
        { text: 'Cancelar', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })) }
      ]);
      return;
    }

    // Fluxo de Confirmação de Local e Data
    setModalConfig({
      visible: true,
      title: 'Marcar como Assistido',
      message: 'Onde você assistiu a este filme?',
      type: 'info',
      buttons: [
        { 
          text: 'No Cinema 🍿', 
          onPress: () => startWatchConfirmFlow('Cinema'),
          primary: true 
        },
        { 
          text: 'Em Casa 🏠', 
          onPress: () => startWatchConfirmFlow('Casa')
        },
        { 
          text: 'Outro 📍', 
          onPress: () => startWatchConfirmFlow('Outro') 
        },
        { text: 'Cancelar', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })) }
      ]
    });
  };

  const startWatchConfirmFlow = (location: string) => {
    setModalConfig(prev => ({ ...prev, visible: false }));
    setPendingStatus('watched');
    setPendingLocation(location);
    setTempDate(new Date());
    setShowDatePicker(true);
  };

  const removeLastSession = async () => {
    if (history.length === 0) return;
    const lastSession = history[0]; // O history já vem ordenado pela data decrescente
    const { error } = await supabase.from('user_movies').delete().eq('id', lastSession.id);
    if (!error) {
       await loadUserData();
       showModal('Removido', 'A última visualização foi removido do seu histórico.', 'success');
    }
  };

  const toggleWishlist = async (location: string) => {
    
    try {
      if (userMovieStatus === 'wishlist' && userMovieLocation === location) {
        // Remover da Agenda
        let query = supabase.from('user_movies').delete().eq('movie_id', movie.id).eq('status', 'wishlist');
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        await query;
        // Cancelar notificações
        await cancelMovieAlerts(Number(id));
        
        setUserMovieStatus(history.length > 0 ? 'watched' : null);
        setUserMovieLocation(null);
        setUserMovieViewingDate(null);
        showModal('Removido', 'Filme removido da sua agenda.', 'info');
      } else {
        // PERGUNTA O QUE DESEJA FAZER (Menu de Escolha)
        setModalConfig({
          visible: true,
          title: 'Adicionar à Agenda',
          message: `Como você deseja salvar "${movie.title}"?`,
          type: 'info',
          buttons: [
            { 
              text: 'Agendar com Alerta 🔔', 
              onPress: () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setPendingStatus('wishlist');
                startCalendarFlow(location);
              }, 
              primary: true 
            },
            { 
              text: 'Quero Assistir (Sem data) 📌', 
              onPress: () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                saveToAgenda(location, null);
              }
            },
            { text: 'Cancelar', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })) }
          ]
        });
      }
    } catch (err) {
      showModal('Erro', 'Falha ao atualizar agenda.', 'error');
    }
  };

  const startCalendarFlow = (location: string) => {
    setPendingLocation(location);
    const cinemaDate = movie.release_date ? new Date(movie.release_date) : new Date();
    let initialDate = cinemaDate > new Date() ? cinemaDate : new Date();
    
    if (cinemaDate < new Date() && digitalDate) {
      const dDate = new Date(digitalDate);
      if (dDate > new Date()) initialDate = dDate;
    }
    
    setTempDate(initialDate);
    setShowDatePicker(true);
  };

  const handleDateConfirm = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed') {
      setPendingLocation(null);
      return;
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      setShowTimePicker(true);
    }
  };

  const handleTimeConfirm = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'dismissed') {
      setPendingLocation(null);
      setPendingStatus(null);
      return;
    }
    if (selectedDate && pendingLocation) {
      if (pendingStatus === 'watched') {
        await saveToHistory(pendingLocation, selectedDate);
      } else {
        await saveToAgenda(pendingLocation, selectedDate);
      }
    }
    setPendingLocation(null);
    setPendingStatus(null);
  };

  const saveToHistory = async (location: string, date: Date) => {
    try {
      // 1. Sempre remove da Agenda (wishlist) ao marcar como assistido
      let deleteQuery = supabase.from('user_movies').delete().eq('movie_id', movie.id).eq('status', 'wishlist');
      if (session) {
        deleteQuery = deleteQuery.eq('user_id', session.user.id);
      }
      await deleteQuery;
      
      // 2. Insere uma nova visualização no histórico
      const { error } = await supabase.from('user_movies').insert({
        user_id: session ? session.user.id : null,
        movie_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        status: 'watched',
        location,
        media_type: 'movie',
        vote_average: movie.vote_average,
        runtime: movie.runtime,
        added_at: date.toISOString(), // Usamos a data escolhida pelo usuário
        genre_ids: movie.genres?.map((g: any) => g.id) || []
      });

      if (!error) {
        await loadUserData();
        showModal('Sucesso!', 'Visualização registrada no histórico!', 'success');
      }
    } catch (err) {
       showModal('Erro', 'Não foi possível salvar histórico.', 'error');
    }
  };

  const saveToAgenda = async (location: string, viewingDate: Date | null) => {
    try {
      // 1. Permissões de Notificação (Só pede se for agendar com data)
      const hasPermission = viewingDate ? await requestNotificationPermissions() : false;
      
      // 2. Deletar anterior da agenda
      let deleteQuery = supabase.from('user_movies').delete().eq('movie_id', movie.id).eq('status', 'wishlist');
      if (session) {
        deleteQuery = deleteQuery.eq('user_id', session.user.id);
      }
      await deleteQuery;
      
      // 3. Salvar no Banco
      const { error } = await supabase.from('user_movies').insert({
        user_id: session ? session.user.id : null,
        movie_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date,
        status: 'wishlist',
        location,
        viewing_date: viewingDate ? viewingDate.toISOString() : null,
        media_type: 'movie',
        vote_average: movie.vote_average,
        runtime: movie.runtime,
        added_at: new Date().toISOString(),
        genre_ids: movie.genres?.map((g: any) => g.id) || []
      });

      if (error) throw error;

      // 4. Agendar Notificações locais (Se houver data)
      if (viewingDate && hasPermission) {
        await scheduleMovieAlerts(movie.id, movie.title, viewingDate, session ? session.user.id : 'local');
      }

      setUserMovieStatus('wishlist');
      setUserMovieLocation(location);
      setUserMovieViewingDate(viewingDate ? viewingDate.toISOString() : null);
      
      showModal(
        'Agenda Atualizada', 
        viewingDate 
          ? `Agendado para ${viewingDate.toLocaleDateString('pt-BR')} às ${viewingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Alerta configurado! 🔔`
          : 'Adicionado à sua lista "Quero Assistir" com sucesso! 📌', 
        'success'
      );
    } catch (error: any) {
       showModal('Erro', `Falha ao processar agendamento: ${error.message}`, 'error');
    }
  };

  const deleteSession = async (sessionId: string) => {
    showModal('Excluir Sessão?', 'Deseja remover esta data específica do seu histórico?', 'warning', [
      { 
        text: 'Sim', 
        destructive: true, 
        onPress: async () => {
          const { error } = await supabase.from('user_movies').delete().eq('id', sessionId);
          if (!error) {
            setModalConfig(prev => ({ ...prev, visible: false }));
            await loadUserData();
          }
        }
      },
      { text: 'Cancelar', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })) }
    ]);
  };

  const clearHistory = async () => {
    showModal('Limpar Tudo?', 'Deseja apagar TODO o histórico de visualizações deste filme?', 'warning', [
      { 
        text: 'Sim', 
        destructive: true, 
        onPress: async () => {
          let query = supabase.from('user_movies').delete().eq('movie_id', movie.id).eq('status', 'watched');
          if (session) {
            query = query.eq('user_id', session.user.id);
          }
          const { error } = await query;
          if (!error) {
            setModalConfig(prev => ({ ...prev, visible: false }));
            await loadUserData();
          }
        }
      },
      { text: 'Cancelar', onPress: () => setModalConfig(prev => ({ ...prev, visible: false })) }
    ]);
  };

  const handleShare = async () => {
    try {
      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
      const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}` : '';
      const url = `https://www.themoviedb.org/movie/${movie.id}`;
      
      const message = `Confira esse filme no CineQuest!\n\n🎬 *${movie.title}* (${year})\n${rating}\n\nVeja mais detalhes aqui: ${url}`;
      
      await Share.share({
        message,
        url,
        title: movie.title
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  // Seções memorizadas para evitar re-renders e flashes
  const castSection = useMemo(() => {
    if (!movie?.credits?.cast || movie.credits.cast.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Elenco e Equipe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {movie.credits.cast.map((actor: any) => (
            <TouchableOpacity 
              key={actor.id} 
              style={styles.actorCard}
              onPress={() => router.push(`/actor/${actor.id}`)}
             >
               <Image 
                 source={{ uri: tmdbService.getImageUrl(actor.profile_path, 'w500') || undefined }} 
                 style={styles.actorImage} 
                 contentFit="cover"
                 transition={300}
                 cachePolicy="disk"
               />
               <Text style={[styles.actorName, { color: colors.text }]} numberOfLines={1}>{actor.name}</Text>
               <Text style={[styles.actorCharacter, { color: colors.icon }]} numberOfLines={1}>{actor.character}</Text>
             </TouchableOpacity>
           ))}
         </ScrollView>
       </View>
    );
  }, [movie?.credits?.cast, colors]);

  const studiosSection = useMemo(() => {
    if (!movie?.production_companies || movie.production_companies.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Estúdios e Produção</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {movie.production_companies.map((company: any) => (
            <View key={company.id} style={styles.studioCard}>
              <View style={[styles.studioLogoContainer, { backgroundColor: '#FFF', borderColor: colors.border, borderWidth: 1 }]}>
                {company.logo_path ? (
                  <Image 
                    source={{ uri: tmdbService.getImageUrl(company.logo_path, 'w500') || undefined }} 
                    style={styles.studioLogo} 
                    contentFit="contain"
                    transition={300}
                    cachePolicy="disk"
                  />
                ) : (
                  <Video size={24} color="#666" />
                )}
              </View>
              <Text style={[styles.studioName, { color: colors.text }]} numberOfLines={1}>{company.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [movie?.production_companies, colors]);

  const videosSection = useMemo(() => {
    if (!movie?.videos?.results || movie.videos.results.length === 0) return null;
    const trailers = movie.videos.results.filter((v: any) => v.type === 'Trailer' || v.type === 'Teaser');
    if (trailers.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>Vídeos e Trailers</Text>
           <Video size={20} color="#FF0000" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {trailers.slice(0, 5).map((video: any) => (
            <TouchableOpacity 
              key={video.id} 
              style={styles.videoCard}
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.key}`)}
            >
              <View style={styles.videoThumbContainer}>
                <Image 
                  source={{ uri: `https://img.youtube.com/vi/${video.key}/mqdefault.jpg` }} 
                  style={styles.videoThumb} 
                  contentFit="cover"
                  transition={300}
                  cachePolicy="disk"
                />
                <View style={styles.playOverlay}>
                  <Play size={24} color="#FFF" fill="#FFF" />
                </View>
              </View>
              <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>{video.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [movie?.videos?.results, colors]);

  const isInTheaters = useMemo(() => {
    if (!movie?.release_date) return false;
    const rd = new Date(movie.release_date);
    const now = new Date();
    const diffDays = (now.getTime() - rd.getTime()) / (1000 * 3600 * 24);
    return rd > now || diffDays <= 90;
  }, [movie?.release_date]);

  const collectionSection = useMemo(() => {
    if (!collectionMovies || collectionMovies.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {movie?.belongs_to_collection?.name || 'Série de Filmes'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {collectionMovies.map((m: any) => (
            <MovieCard 
              key={m.id} 
              movie={{ ...m, media_type: 'movie' }}
              onPress={() => router.push(`/movie/${m.id}`)}
              width={140}
            />
          ))}
        </ScrollView>
      </View>
    );
  }, [collectionMovies, movie?.belongs_to_collection?.name, colors]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!movie) return null;

  const backdropUrl = tmdbService.getImageUrl(movie.backdrop_path, 'original');

  return (
    <ScrollView 
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: colors.background }]} 
      bounces={false} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      <View style={styles.header}>
        <Image 
          source={{ uri: backdropUrl || undefined }} 
          style={styles.backdrop} 
          contentFit="cover" 
          transition={300}
          cachePolicy="disk"
        />
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent', colors.background]} style={styles.gradient} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.backButton, { left: undefined, right: 20 }]} onPress={handleShare}>
          <Share2 size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <Image 
            source={{ uri: tmdbService.getImageUrl(movie.poster_path) || undefined }} 
            style={styles.poster} 
            contentFit="cover" 
            transition={300}
            cachePolicy="disk"
          />
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{movie.title}</Text>
            <View style={styles.metaInfo}>
              <View style={styles.ratingBadge}>
                <Star size={16} fill="#FBBF24" color="#FBBF24" />
                <Text style={styles.ratingText}>{movie.vote_average?.toFixed(1)}</Text>
              </View>
              <Text style={{ color: colors.icon }}>•</Text>
              <Text style={{ color: colors.icon }}>{movie.runtime} min</Text>
            </View>
          </View>
        </View>

        {/* Gêneros abaixo da foto */}
        {movie.genres && movie.genres.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreScrollBelow}>
            {movie.genres.map((genre: any) => (
              <View key={genre.id} style={[styles.genreBadge, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.genreText, { color: colors.text }]}>{genre.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.premiereGrid}>
          <View style={[styles.premiereContainer, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <CalendarPlus size={18} color={colors.tint} />
            <View style={{ flex: 1 }}>
              <Text 
                style={[styles.premiereLabel, { color: colors.icon }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                Estreia Cinema
              </Text>
              <Text 
                style={[styles.premiereDate, { color: colors.text }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {new Date(movie.release_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>

          {digitalDate && (
            <View style={[styles.premiereContainer, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <Tv size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text 
                  style={[styles.premiereLabel, { color: colors.icon }]} 
                  numberOfLines={1} 
                  adjustsFontSizeToFit
                >
                  Estreia Digital
                </Text>
                <Text 
                  style={[styles.premiereDate, { color: colors.text }]} 
                  numberOfLines={1} 
                  adjustsFontSizeToFit
                >
                  {new Date(digitalDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>
          )}
        </View>

        <ExpandableText 
          text={movie.overview} 
          colors={colors} 
          style={{ color: colors.text }} 
        />

        {/* Onde Assistir */}
        {(movie['watch/providers']?.results?.BR || movie['watch_providers']?.results?.BR) && (
          <View style={[styles.sectionContainer, { marginTop: 20 }]}>
            {(() => {
              const providers = movie['watch/providers']?.results?.BR || movie['watch_providers']?.results?.BR;
              const list = [
                ...(providers.flatrate || []),
                ...(providers.rent || []),
                ...(providers.buy || [])
              ].reduce((acc: any[], curr: any) => {
                if (!acc.find(item => item.provider_id === curr.provider_id)) acc.push(curr);
                return acc;
              }, []);

              return (
                <>
                  <View style={styles.sectionHeaderRow}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                       <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Onde Assistir</Text>
                       <Tv size={20} color={colors.tint} />
                     </View>
                     {providers.link && (
                       <TouchableOpacity 
                         onPress={() => Linking.openURL(providers.link)}
                         style={{ 
                           flexDirection: 'row', 
                           alignItems: 'center', 
                           gap: 4, 
                           backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                           paddingHorizontal: 10, 
                           paddingVertical: 6, 
                           borderRadius: 12,
                           borderWidth: 1,
                           borderColor: 'rgba(255, 255, 255, 0.1)'
                         }}
                         activeOpacity={0.7}
                       >
                         <Text style={{ color: colors.tint, fontSize: 12, fontWeight: 'bold' }}>Links Diretos 🌐</Text>
                       </TouchableOpacity>
                     )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {list.length === 0 ? (
                      <Text style={{ color: colors.icon, fontStyle: 'italic', marginLeft: 5 }}>Disponível apenas em canais de TV ou mídia física.</Text>
                    ) : (
                      list.map((provider: any) => (
                        <TouchableOpacity 
                          key={provider.provider_id} 
                          style={styles.providerItem}
                          onPress={() => openWatchProvider(provider.provider_name, movie.title, providers.link)}
                          activeOpacity={0.7}
                        >
                          <Image 
                            source={{ uri: tmdbService.getImageUrl(provider.logo_path, 'w500') || undefined }} 
                            style={styles.providerLogo} 
                            contentFit="cover"
                            transition={300}
                            cachePolicy="disk"
                          />
                          <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>{provider.provider_name}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        )}

        {/* Gerenciamento de Status */}
        <View style={styles.actionsBox}>
          <Text style={[styles.actionsTitle, { color: colors.text }]}>Minha Gestão</Text>
          <View style={styles.actionRow}>
            {(isInTheaters || (userMovieStatus === 'wishlist' && userMovieLocation === 'Cinema')) && (
              <TouchableOpacity 
                style={[styles.actionButton, { flex: 1, backgroundColor: userMovieStatus === 'wishlist' && userMovieLocation === 'Cinema' ? colors.tint : colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                onPress={() => toggleWishlist('Cinema')}
              >
                <MapPin size={18} color={userMovieStatus === 'wishlist' && userMovieLocation === 'Cinema' ? '#FFF' : colors.text} />
                <Text style={[styles.actionText, { color: userMovieStatus === 'wishlist' && userMovieLocation === 'Cinema' ? '#FFF' : colors.text }]}>No Cinema</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.actionButton, { flex: 1, backgroundColor: userMovieStatus === 'wishlist' && userMovieLocation === 'Casa' ? colors.tint : colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
              onPress={() => toggleWishlist('Casa')}
            >
              <Tv size={18} color={userMovieStatus === 'wishlist' && userMovieLocation === 'Casa' ? '#FFF' : colors.text} />
              <Text style={[styles.actionText, { color: userMovieStatus === 'wishlist' && userMovieLocation === 'Casa' ? '#FFF' : colors.text }]}>Em Casa</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.mainActionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
            onPress={() => markAsWatched()}
          >
            <Library size={20} color={colors.tint} />
            <Text style={[styles.mainActionText, { color: colors.text }]}>
              {history.length > 0 ? `Assistir Novamente (${history.length}x)` : 'Marcar como Assistido'}
            </Text>
          </TouchableOpacity>

          {userMovieStatus === 'wishlist' && userMovieViewingDate && (
             <View style={[styles.scheduledInfo, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' }]}>
                <Clock size={16} color="#10B981" />
                <Text style={[styles.scheduledText, { color: colors.text }]}>
                   Agendado: {new Date(userMovieViewingDate).toLocaleDateString('pt-BR')} às {new Date(userMovieViewingDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
             </View>
          )}
        </View>

        {/* Date / Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={editingSession ? new Date(editingSession.added_at) : tempDate}
            mode="date"
            display={RNPlatform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={editingSession ? handleHistoryDateChange : handleDateConfirm}
            minimumDate={pendingStatus === 'watched' || editingSession ? undefined : new Date()}
            maximumDate={pendingStatus === 'watched' || editingSession ? new Date() : undefined}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={tempDate}
            mode="time"
            display={RNPlatform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeConfirm}
          />
        )}

        {/* Histórico de Datas */}
        {history.length > 0 && (
          <View style={[styles.historyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <View style={styles.historyHeader}>
                <View style={styles.historyTitleRow}>
                   <Clock size={16} color={colors.tint} />
                   <Text style={[styles.historyTitle, { color: colors.text }]}>Seu Histórico</Text>
                </View>
                <TouchableOpacity onPress={clearHistory}>
                   <Text style={[styles.clearText, { color: '#EF4444' }]}>Apagar Tudo</Text>
                </TouchableOpacity>
             </View>
             {history.map((session, index) => (
                <TouchableOpacity 
                  key={session.id} 
                  style={[styles.historyItem, { borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }]}
                  onPress={() => {
                    setEditingSession(session);
                    setShowDatePicker(true);
                  }}
                >
                   <View style={styles.historyInfo}>
                      <CalendarDays size={14} color={colors.icon} />
                      <Text style={[styles.historyDate, { color: colors.text }]}>
                         {new Date(session.added_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                   </View>
                   <TouchableOpacity onPress={() => deleteSession(session.id)} style={styles.deleteBtn}>
                      <Trash2 size={16} color={colors.icon} />
                   </TouchableOpacity>
                </TouchableOpacity>
             ))}
          </View>
        )}

        {/* Seções de Mídia */}
        {castSection}
        {videosSection}
        {studiosSection}

        {/* Notícias */}
        {movie.reviews?.results && movie.reviews.results.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>Notícias</Text>
               <Newspaper size={20} color={colors.tint} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {movie.reviews.results.slice(0, 5).map((review: any) => (
                <View key={review.id} style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                     <View style={[styles.avatarCircle, { backgroundColor: colors.tint + '20' }]}>
                        <Text style={{ color: colors.tint, fontWeight: 'bold' }}>{review.author[0].toUpperCase()}</Text>
                     </View>
                     <Text style={[styles.reviewAuthor, { color: colors.text }]} numberOfLines={1}>{review.author}</Text>
                  </View>
                  <Text style={[styles.newsContent, { color: colors.text }]} numberOfLines={4}>
                    {review.content}
                  </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(review.url)} style={styles.readMoreBtn}>
                     <Text style={[styles.readMore, { color: colors.tint }]}>Ler íntegra no TMDB</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}



        {collectionSection}
        {recommendationsSection}

        {movie.similar?.results && movie.similar.results.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Filmes Relacionados</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {movie.similar.results.slice(0, 10).map((similarMovie: any) => (
                <MovieCard key={similarMovie.id} movie={similarMovie} onPress={(m: any) => router.push(`/movie/${m.id}`)} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <CustomModal
        {...modalConfig}
        onClose={() => setModalConfig({ ...modalConfig, visible: false })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { width: '100%', height: height * 0.45, position: 'relative' },
  backdrop: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  backButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  mainInfo: { flexDirection: 'row', gap: 20 },
  poster: { width: 120, height: 180, borderRadius: 12, marginTop: -90, borderWidth: 3, borderColor: '#000', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10 },
  titleContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 5 },
  title: { fontSize: 24, fontWeight: 'bold' },
  metaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  ratingText: { color: '#FBBF24', fontWeight: 'bold' },
  premiereGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  premiereContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 16, borderWidth: 1 },
  premiereLabel: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  premiereDate: { fontSize: 13, fontWeight: 'bold' },
  genreScrollBelow: { gap: 8, marginTop: 15, paddingBottom: 5 },
  genreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  genreText: { fontSize: 11, fontWeight: 'bold' },
  overview: { fontSize: 16, lineHeight: 24, opacity: 0.9, marginBottom: 30 },
  actionsBox: { gap: 12, marginBottom: 30 },
  actionsTitle: { fontSize: 16, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, gap: 8 },
  mainActionButton: { flexDirection: 'row', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10 },
  actionText: { fontSize: 14, fontWeight: 'bold' },
  mainActionText: { fontSize: 16, fontWeight: 'bold' },
  sectionContainer: { marginTop: 30 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold' },
  actorCard: { width: 110, marginRight: 15, alignItems: 'center' },
  actorImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  actorName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actorCharacter: { fontSize: 11, textAlign: 'center', marginTop: 2, opacity: 0.8 },
  studioCard: { width: 120, marginRight: 15, alignItems: 'center' },
  studioLogoContainer: { width: 110, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8, padding: 10, overflow: 'hidden' },
  studioLogo: { width: '100%', height: '100%' },
  studioName: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  scrollContent: { paddingHorizontal: 5 },
  
  // Vídeos
  videoCard: { width: 220, marginRight: 15 },
  videoThumbContainer: { width: 220, height: 124, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.8 },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  videoTitle: { fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 18 },

  // Reviews
  newsCard: { width: 280, padding: 15, borderRadius: 20, borderWidth: 1, marginRight: 15, minHeight: 180 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  reviewAuthor: { fontSize: 14, fontWeight: 'bold', flex: 1 },
  newsContent: { fontSize: 13, lineHeight: 18, opacity: 0.8, marginBottom: 12 },
  readMoreBtn: { alignSelf: 'flex-start' },
  readMore: { fontSize: 12, fontWeight: 'bold' },
  
  // Onde Assistir
  providerItem: { alignItems: 'center', marginRight: 20, width: 60 },
  providerLogo: { width: 45, height: 45, borderRadius: 12, marginBottom: 6 },
  providerName: { fontSize: 10, textAlign: 'center', fontWeight: '500' },

  // Estilos do Histórico
  historyBox: { padding: 15, borderRadius: 18, borderWidth: 1, marginTop: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { fontSize: 16, fontWeight: 'bold' },
  clearText: { fontSize: 11, fontWeight: 'bold' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  historyInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontSize: 13, fontWeight: '600' },
  deleteBtn: { padding: 5 },
  scheduledInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  scheduledText: { fontSize: 13, fontWeight: 'bold' },
});
