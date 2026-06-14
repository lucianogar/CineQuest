import CustomModal from '@/components/CustomModal';
import MovieCard from '@/components/MovieCard';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/services/supabase';
import { tmdbService, getAiredEpisodesCount } from '@/services/tmdb';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform as RNPlatform, InteractionManager, Linking, Share } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check, Star, CalendarPlus, Library, Clock, ArrowLeft, Trash2, ChevronDown, ChevronUp, CheckCircle2, Rocket, CalendarDays, TrendingUp, Play, MessageSquareText, Video, Newspaper, Tv, Share2 } from 'lucide-react-native';
import { 
  CastSection, 
  StudiosSection, 
  VideosSection, 
  WatchProvidersSection, 
  HistorySection, 
  ReviewsSection, 
  SimilarSeriesSection,
  RecommendationsSection,
  SeasonCard,
  EpisodeItem
} from '@/components/tv/SectionComponents';
import DateTimePicker from '@react-native-community/datetimepicker';
import { requestNotificationPermissions, scheduleMovieAlerts, cancelMovieAlerts } from '@/services/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpandableText } from '@/components/ui/ExpandableText';

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { width: '100%', height: height * 0.45, position: 'relative' },
  backdrop: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  backButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  content: { padding: 20 },
  mainInfo: { flexDirection: 'row', gap: 20 },
  poster: { width: 120, height: 180, borderRadius: 12, marginTop: -90, borderWidth: 3, borderColor: '#000', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10 },
  titleContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 5 },
  title: { fontSize: 24, fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontWeight: 'bold', color: '#FBBF24' },
  year: { fontSize: 13, opacity: 0.6, fontWeight: '600' },
  
  genreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  genreText: { fontSize: 11, fontWeight: 'bold' },
  genreScrollBelow: { gap: 8, marginTop: 15, paddingBottom: 5 },
  
  sectionContainer: { marginTop: 30 },
  section: { marginTop: 30 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  overview: { fontSize: 16, lineHeight: 24, opacity: 0.8 },
  
  nextSeasonTitle: { fontSize: 16, fontWeight: 'bold' },
  notifyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  notifyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  actionBar: { flexDirection: 'row', gap: 10, marginTop: 30 },
  actionBtn: { flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 2 },
  actionBtnText: { fontWeight: 'bold', fontSize: 15 },
  scheduledCard: { marginTop: 25, padding: 20, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  scheduledIconBox: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  scheduledInfoContent: { flex: 1, gap: 4 },
  scheduledInfoLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 2 },
  scheduledDate: { fontSize: 18, fontWeight: 'bold' },
  scheduledTime: { fontSize: 15, fontWeight: '700' },
  
  infoGrid: { flexDirection: 'row', gap: 8, marginTop: 25 },
  infoCard: { flex: 1, paddingVertical: 15, paddingHorizontal: 4, borderRadius: 16, alignItems: 'center', gap: 4, minHeight: 80, justifyContent: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', opacity: 0.6 },
  infoValue: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', width: '100%' },

  progressBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  progressText: { fontSize: 12, fontWeight: 'bold' },
  seasonsCarousel: { gap: 12, paddingBottom: 10, paddingHorizontal: 4 },
  
  selectedSeasonDetails: { marginTop: 20, padding: 15, borderRadius: 20, gap: 20, minHeight: 250 },
  selectedSeasonInfoRow: { flexDirection: 'row', gap: 15 },
  selectedSeasonPoster: { width: 80, height: 120, borderRadius: 12 },
  selectedSeasonMeta: { flex: 1, justifyContent: 'center', gap: 4 },
  selectedSeasonTitle: { fontSize: 18, fontWeight: 'bold' },
  selectedSeasonDate: { fontSize: 12 },
  selectedSeasonEpCount: { fontSize: 13, fontWeight: 'bold' },
  checkAllBtnCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 5, alignSelf: 'flex-start' },
  checkAllText: { fontSize: 13, fontWeight: 'bold' },
  episodesListContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15, gap: 10 },
  
  nextSeasonCard: { marginTop: 30, padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextSeasonInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  nextSeasonLabel: { fontSize: 10, fontWeight: 'bold' },
});

// SeasonCard e outros componentes de seção foram movidos para @/components/tv/SectionComponents

export default function TvDetailsScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [tvShow, setTvShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<'wishlist' | 'watched' | 'watching' | null>(null);
  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  // Estados para Progresso de Episódios
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [seasonsData, setSeasonsData] = useState<Map<number, any>>(new Map());
  const [fetchingSeason, setFetchingSeason] = useState(false);

  // Estados para Agendamento
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [editingSession, setEditingSession] = useState<any>(null);
  const [pendingSeasonNum, setPendingSeasonNum] = useState<number | null>(null);
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

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  useEffect(() => {
    async function loadAllData() {
      if (!id) return;
      
      try {
        // BUSCA PARALELA TOTAL: TMDB + Supabase (Filmes) + Supabase (Episódios)
        const tmdbPromise = tmdbService.getTvDetails(Number(id));
        
        let moviesQuery = supabase.from('user_movies').select('*');
        if (session) {
          moviesQuery = moviesQuery.eq('user_id', session.user.id);
        }
        const userMoviesPromise = moviesQuery.eq('movie_id', Number(id)).order('added_at', { ascending: false });

        let epsQuery = supabase.from('user_episodes').select('season_number, episode_number');
        if (session) {
          epsQuery = epsQuery.eq('user_id', session.user.id);
        }
        const userEpisodesPromise = epsQuery.eq('series_id', Number(id));

        const [tvData, userMoviesRes, userEpisodesRes] = await Promise.all([
          tmdbPromise,
          userMoviesPromise,
          userEpisodesPromise
        ]);

        // 1. Processar dados da Série (TMDB)
        await filterWatchedTvContent(tvData);
        setTvShow(tvData);

        // 2. Processar Episódios Assistidos ( user_episodes )
        let watchedCount = 0;
        if (userEpisodesRes && userEpisodesRes.data) {
          const set = new Set<string>();
          userEpisodesRes.data.forEach((ep: any) => set.add(`${ep.season_number}-${ep.episode_number}`));
          setWatchedEpisodes(set);
          watchedCount = set.size;
        }

        // 3. Processar Dados do Usuário ( user_movies )
        if (userMoviesRes && userMoviesRes.data) {
          const data = userMoviesRes.data;
          setHistory(data);
          
          let wishlist = data.find((m: any) => m.status === 'wishlist');
          let watching = data.find((m: any) => m.status === 'watching');
          let watched = data.find((m: any) => m.status === 'watched');

          const activeRecord = watching || watched;
          if (activeRecord) {
            const totalAired = getAiredEpisodesCount(tvData);
            const totalEpisodes = totalAired > 0 ? totalAired : (tvData.number_of_episodes || 1);
            
            let calculatedStatus: 'watched' | 'watching' = 'watched';
            if (watchedCount > 0 && watchedCount < totalEpisodes) {
              calculatedStatus = 'watching';
            }

            if (activeRecord.status !== calculatedStatus) {
              await supabase
                .from('user_movies')
                .update({ status: calculatedStatus })
                .eq('id', activeRecord.id);
              
              activeRecord.status = calculatedStatus;
              if (calculatedStatus === 'watching') {
                watching = activeRecord;
                watched = undefined;
              } else {
                watched = activeRecord;
                watching = undefined;
              }
            }
          }

          if (watching) {
            setUserStatus('watching');
            setViewingDate(null);
          } else if (wishlist) {
            setUserStatus('wishlist');
            setViewingDate(wishlist.viewing_date);
          } else if (watched) {
            setUserStatus('watched');
            setViewingDate(null);
          } else {
            setUserStatus(null);
            setViewingDate(null);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }

    async function filterWatchedTvContent(tvData: any) {
      if (!tvData) return;
      try {
        const recIds = tvData.recommendations?.results?.map((m: any) => m.id) || [];
        const simIds = tvData.similar?.results?.map((m: any) => m.id) || [];
        const allIds = [...new Set([...recIds, ...simIds])];

        if (allIds.length === 0) return;

        let query = supabase.from('user_movies').select('movie_id');
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        const { data: watchedData } = await query
          .in('movie_id', allIds)
          .in('status', ['watched', 'watching']);

        if (watchedData && watchedData.length > 0) {
          const watchedIds = new Set(watchedData.map((w: any) => w.movie_id));
          if (tvData.recommendations?.results) {
            tvData.recommendations.results = tvData.recommendations.results.filter((m: any) => !watchedIds.has(m.id));
          }
          if (tvData.similar?.results) {
            tvData.similar.results = tvData.similar.results.filter((m: any) => !watchedIds.has(m.id));
          }
        }
      } catch (e) {
        console.error('Erro ao filtrar séries assistidas:', e);
      }
    }

    const task = InteractionManager.runAfterInteractions(() => {
      loadAllData();
    });

    return () => task.cancel();
  }, [id, session]);

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
    const { data, error } = await query
      .eq('movie_id', Number(id))
      .order('added_at', { ascending: false });

    if (!error && data) {
      setHistory(data);
      const wishlist = data.find((m: any) => m.status === 'wishlist');
      const watching = data.find((m: any) => m.status === 'watching');
      const watched = data.find((m: any) => m.status === 'watched');

      if (watching) {
        setUserStatus('watching');
        setViewingDate(null);
      } else if (wishlist) {
        setUserStatus('wishlist');
        setViewingDate(wishlist.viewing_date);
      } else if (watched) {
        setUserStatus('watched');
        setViewingDate(null);
      } else {
        setUserStatus(null);
        setViewingDate(null);
      }
    }
  };

  const handleAddToCollection = async () => {

    // Fluxo de Confirmação de Local e Data
    setModalConfig({
      visible: true,
      title: 'Marcar como Assistido',
      message: 'Onde você assistiu a esta série?',
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

  const deleteSession = async (sessionId: string) => {
    const { error } = await supabase.from('user_movies').delete().eq('id', sessionId);
    if (!error) {
       await loadUserData();
       showModal('Removido', 'A sessão foi removida do seu histórico.', 'success');
    }
  };

  const clearHistory = async () => {
    let query = supabase.from('user_movies').delete().eq('movie_id', Number(id)).eq('status', 'watched');
    if (session) {
      query = query.eq('user_id', session.user.id);
    }
    const { error } = await query;
    
    if (!error) {
      await loadUserData();
      showModal('Limpo', 'Todo o histórico desta série foi apagado.', 'success');
    }
  };

  const handleShare = async () => {
    try {
      const year = tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear() : 'N/A';
      const rating = tvShow.vote_average ? `⭐ ${tvShow.vote_average.toFixed(1)}` : '';
      const url = `https://www.themoviedb.org/tv/${tvShow.id}`;
      
      const message = `Confira essa série no CineQuest!\n\n📺 *${tvShow.name}* (${year})\n${rating}\n\nVeja mais detalhes aqui: ${url}`;
      
      await Share.share({
        message,
        url,
        title: tvShow.name
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  const toggleWishlist = async () => {
    try {
      if (userStatus === 'wishlist') {
        // Remover da Agenda
        let query = supabase.from('user_movies').delete().eq('movie_id', tvShow.id).eq('status', 'wishlist');
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        await query;
        // Cancelar notificações
        await cancelMovieAlerts(Number(id));
        
        await loadUserData();
        showModal('Removido', 'Série removida da sua agenda.', 'info');
      } else {
        // PERGUNTA O QUE DESEJA FAZER (Menu de Escolha)
        setModalConfig({
          visible: true,
          title: 'Adicionar à Agenda',
          message: `Como você deseja salvar "${tvShow.name}"?`,
          type: 'info',
          buttons: [
            { 
              text: 'Agendar Alerta 🔔', 
              onPress: () => {
                setModalConfig((prev: any) => ({ ...prev, visible: false }));
                startCalendarFlow();
              }, 
              primary: true 
            },
            { 
              text: 'Quero Assistir (Sem data) 📌', 
              onPress: () => {
                setModalConfig((prev: any) => ({ ...prev, visible: false }));
                saveToAgenda(null);
              }
            },
            { text: 'Cancelar', onPress: () => setModalConfig((prev: any) => ({ ...prev, visible: false })) }
          ]
        });
      }
    } catch (err) {
      showModal('Erro', 'Falha ao atualizar agenda.', 'error');
    }
  };

  const startCalendarFlow = () => {
    const initialDate = tvShow.first_air_date ? new Date(tvShow.first_air_date) : new Date();
    const finalInitialDate = initialDate > new Date() ? initialDate : new Date();
    setTempDate(finalInitialDate);
    setShowDatePicker(true);
  };

  const handleDateConfirm = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed') return;
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
    if (selectedDate) {
      if (pendingStatus === 'watched' && pendingLocation) {
        await saveToHistory(pendingLocation, selectedDate);
      } else {
        await saveToAgenda(selectedDate);
      }
    }
    setPendingLocation(null);
    setPendingStatus(null);
  };

  const saveToHistory = async (location: string, date: Date) => {
    try {
      // 1. Remover da Agenda (wishlist) ao marcar como assistido
      let deleteQuery = supabase.from('user_movies').delete().eq('movie_id', tvShow.id).eq('status', 'wishlist');
      if (session) {
        deleteQuery = deleteQuery.eq('user_id', session.user.id);
      }
      await deleteQuery;
      
      // 2. Insere ou atualiza o status para visto no histórico
      const { error } = await supabase.from('user_movies').insert({
        user_id: session ? session.user.id : null,
        movie_id: tvShow.id,
        title: tvShow.name,
        poster_path: tvShow.poster_path,
        release_date: tvShow.first_air_date,
        status: 'watched',
        location,
        media_type: 'tv',
        added_at: date.toISOString(), // Data escolhida pelo usuário
        genre_ids: tvShow.genres?.map((g: any) => g.id) || []
      });

      if (!error) {
        await loadUserData();
        showModal('Sucesso!', 'Visualização registrada no histórico!', 'success');
      }
    } catch (err) {
       showModal('Erro', 'Não foi possível salvar histórico.', 'error');
    }
  };

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
        showModal('Sucesso', 'Data do histórico atualizada!', 'success');
      }
    } catch (e) {
      showModal('Erro', 'Falha ao atualizar data.', 'error');
    } finally {
      setEditingSession(null);
    }
  };

  const saveToAgenda = async (viewingDate: Date | null) => {
    try {
      // 1. Permissões de Notificação
      const hasPermission = viewingDate ? await requestNotificationPermissions() : false;
      
      // 2. Deletar anterior da agenda
      let deleteQuery = supabase.from('user_movies').delete().eq('movie_id', tvShow.id).eq('status', 'wishlist');
      if (session) {
        deleteQuery = deleteQuery.eq('user_id', session.user.id);
      }
      await deleteQuery;
      
      // 3. Salvar no Banco
      const { error } = await supabase.from('user_movies').insert({
        user_id: session ? session.user.id : null,
        movie_id: tvShow.id,
        title: tvShow.name,
        poster_path: tvShow.poster_path,
        release_date: tvShow.first_air_date,
        status: 'wishlist',
        media_type: 'tv',
        viewing_date: viewingDate ? viewingDate.toISOString() : null,
        added_at: new Date().toISOString(),
        genre_ids: tvShow.genres?.map((g: any) => g.id) || []
      });

      if (error) throw error;

      // 4. Agendar Notificações locais
      if (viewingDate && hasPermission) {
        await scheduleMovieAlerts(tvShow.id, tvShow.name, viewingDate, session ? session.user.id : 'local');
      }

      await loadUserData();
      
      showModal(
        'Agenda Atualizada', 
        viewingDate 
          ? `Série agendada para ${viewingDate.toLocaleDateString('pt-BR')} às ${viewingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Alerta configurado! 🔔`
          : 'Série adicionada à sua lista "Quero Assistir" com sucesso! 📌', 
        'success'
      );
    } catch (error: any) {
       showModal('Erro', `Falha ao salvar série: ${error.message}`, 'error');
    }
  };

  const toggleEpisode = async (seasonNum: number, episodeNum: number) => {
    const key = `${seasonNum}-${episodeNum}`;
    const isWatched = watchedEpisodes.has(key);

    try {
      if (isWatched) {
        let query = supabase.from('user_episodes').delete()
          .eq('series_id', Number(id))
          .eq('season_number', seasonNum)
          .eq('episode_number', episodeNum);
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        await query;
        
        const newSet = new Set(watchedEpisodes);
        newSet.delete(key);
        setWatchedEpisodes(newSet);
        await syncUserMovieStatus(newSet.size);
      } else {
        const { error } = await supabase.from('user_episodes').upsert({
          user_id: session ? session.user.id : null,
          series_id: Number(id),
          season_number: seasonNum,
          episode_number: episodeNum
        }, { onConflict: 'user_id,series_id,season_number,episode_number' });

        if (error) throw error;
        
        const newSet = new Set(watchedEpisodes);
        newSet.add(key);
        setWatchedEpisodes(newSet);
        await syncUserMovieStatus(newSet.size);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const syncUserMovieStatus = async (watchedCount: number) => {
    if (!tvShow) return;
    const totalAired = getAiredEpisodesCount(tvShow);
    const totalEpisodes = totalAired > 0 ? totalAired : (tvShow.number_of_episodes || 1);
    let newStatus: 'wishlist' | 'watched' | 'watching' | null = null;
    
    if (watchedCount > 0 && watchedCount < totalEpisodes) {
      newStatus = 'watching';
    } else if (watchedCount >= totalEpisodes) {
      newStatus = 'watched';
    } else if (watchedCount === 0) {
      const previouslyWatched = history.some(h => h.status === 'watched' || h.status === 'watching');
      if (previouslyWatched && history.length > 0) {
        newStatus = 'watched'; // Mantém como visto se já terminou alguma vez
      } else {
        newStatus = null; // Primeira vez e desmarcou tudo, remove
      }
    }

    try {
      // 1. Limpar status antigo (não-wishlist) antes de inserir o novo
      // Isso é necessário porque removemos a restrição UNIQUE para permitir re-watches de filmes
      let deleteQuery = supabase.from('user_movies').delete()
        .eq('movie_id', Number(id))
        .neq('status', 'wishlist');
      if (session) {
        deleteQuery = deleteQuery.eq('user_id', session.user.id);
      }
      await deleteQuery;

      if (newStatus !== null) {
        // 2. Inserir o novo status atualizado
        const { error: insertError } = await supabase.from('user_movies').insert({
          user_id: session ? session.user.id : null,
          movie_id: id,
          title: tvShow.name,
          poster_path: tvShow.poster_path,
          release_date: tvShow.first_air_date,
          status: newStatus,
          media_type: 'tv',
          vote_average: tvShow.vote_average,
          runtime: tvShow.episode_run_time?.[0] || 0,
          added_at: new Date().toISOString(),
          genre_ids: tvShow.genres?.map((g: any) => g.id) || []
        });

        if (insertError) {
          console.error('Erro ao atualizar status no banco:', insertError);
        }
      }
      await loadUserData();
    } catch (e) {
      console.error('Erro sync status:', e);
    }
  };

  const toggleWholeSeason = async (season: any) => {
    const seasonNum = season.season_number;
    const episodes = seasonsData.get(seasonNum)?.episodes || [];
    if (episodes.length === 0) return;

    const allWatched = episodes.every((ep: any) => watchedEpisodes.has(`${seasonNum}-${ep.episode_number}`));

    try {
      if (allWatched) {
        let query = supabase.from('user_episodes').delete()
          .eq('series_id', Number(id))
          .eq('season_number', seasonNum);
        if (session) {
          query = query.eq('user_id', session.user.id);
        }
        await query;
        
        const newSet = new Set(watchedEpisodes);
        episodes.forEach((ep: any) => newSet.delete(`${seasonNum}-${ep.episode_number}`));
        setWatchedEpisodes(newSet);
        await syncUserMovieStatus(newSet.size);
      } else {
        const upserts = episodes.map((ep: any) => ({
          user_id: session ? session.user.id : null,
          series_id: Number(id),
          season_number: seasonNum,
          episode_number: ep.episode_number
        }));
        
        const { error } = await supabase.from('user_episodes').upsert(upserts, { 
          onConflict: 'user_id,series_id,season_number,episode_number' 
        });

        if (error) {
          console.error('Erro no check-in total:', error);
          showModal('Erro', 'Não foi possível marcar os episódios.', 'error');
          return;
        }
        
        const newSet = new Set(watchedEpisodes);
        episodes.forEach((ep: any) => newSet.add(`${seasonNum}-${ep.episode_number}`));
        setWatchedEpisodes(newSet);
        await syncUserMovieStatus(newSet.size);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpandSeason = useCallback(async (seasonNum: number) => {
    // LayoutAnimation removido por causar bugs nas imagens do carrossel ao colapsar
    
    setExpandedSeason(prev => (prev === seasonNum ? null : seasonNum));

    // Usamos um Ref ou o valor atual do estado de forma segura
    if (!seasonsData.has(seasonNum)) {
      setFetchingSeason(true);
      try {
        const data = await tmdbService.getTvSeason(Number(id), seasonNum);
        setSeasonsData(prev => new Map(prev).set(seasonNum, data));
      } catch (e) {
        console.error(e);
      } finally {
        setFetchingSeason(false);
      }
    }
  }, [id, seasonsData]); // Ainda depende de seasonsData para o check inicial, mas isso é inevitável sem Refs.
 
  const backdropUrl = useMemo(() => tmdbService.getImageUrl(tvShow?.backdrop_path, 'original'), [tvShow?.backdrop_path]);
  const posterUrl = useMemo(() => tmdbService.getImageUrl(tvShow?.poster_path), [tvShow?.poster_path]);

// Seções agora são renderizadas via componentes externos memoizados

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!tvShow) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        ref={scrollViewRef}
        bounces={false} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Header com Backdrop */}
        <View style={styles.header}>
          <Image 
            source={{ uri: backdropUrl || posterUrl || undefined }} 
            style={styles.backdrop} 
            transition={300}
            contentFit="cover"
            cachePolicy="disk"
          />
          <LinearGradient colors={['transparent', colors.background]} style={styles.gradient} />
          
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.backButton, { left: undefined, right: 20 }]} onPress={handleShare}>
            <Share2 size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Conteúdo Principal */}
        <View style={styles.content}>
          <View style={styles.mainInfo}>
            <Image 
              source={{ uri: posterUrl || undefined }} 
              style={styles.poster} 
              transition={300}
              contentFit="cover"
              cachePolicy="disk"
            />
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{tvShow.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.rating}>
                  <Star size={16} color="#FBBF24" fill="#FBBF24" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>{tvShow.vote_average.toFixed(1)}</Text>
                </View>
                <Text style={[styles.year, { color: colors.icon }]}>
                  {tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear() : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Gêneros abaixo da foto */}
          {tvShow.genres && tvShow.genres.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreScrollBelow}>
              {tvShow.genres.map((genre: any) => (
                <View key={genre.id} style={[styles.genreBadge, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.genreText, { color: colors.text }]}>{genre.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Atalhos de Ação */}
          <View style={styles.actionBar}>
            <TouchableOpacity 
              style={[styles.actionBtn, userStatus === 'wishlist' ? { backgroundColor: colors.tint } : { backgroundColor: colors.surface }]}
              onPress={toggleWishlist}
            >
              <CalendarPlus size={20} color={userStatus === 'wishlist' ? '#FFF' : colors.tint} />
              <Text style={[styles.actionBtnText, { color: userStatus === 'wishlist' ? '#FFF' : colors.text }]}>
                {userStatus === 'wishlist' ? 'Agendado' : 'Agendar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, userStatus === 'watching' ? { backgroundColor: '#3B82F6' } : userStatus === 'watched' ? { backgroundColor: colors.tint } : { backgroundColor: colors.surface }]}
              onPress={handleAddToCollection}
            >
              {userStatus === 'watching' ? (
                <TrendingUp size={20} color="#FFF" />
              ) : (
                <Library size={20} color={userStatus === 'watched' ? '#FFF' : colors.tint} />
              )}
              <Text style={[styles.actionBtnText, { color: (userStatus === 'watched' || userStatus === 'watching') ? '#FFF' : colors.text }]}>
                {userStatus === 'watching' ? 'Assistindo' : userStatus === 'watched' ? `Visto (${history.filter(h => h.status === 'watched').length}x)` : 'Já Assisti'}
              </Text>
            </TouchableOpacity>
          </View>

          {userStatus === 'wishlist' && viewingDate && (
             <LinearGradient 
               colors={[colors.tint + '15', colors.tint + '05']} 
               start={{ x: 0, y: 0 }} 
               end={{ x: 1, y: 0 }}
               style={[styles.scheduledCard, { borderColor: colors.tint + '40' }]}
             >
               <View style={[styles.scheduledIconBox, { backgroundColor: colors.tint + '20' }]}>
                 <CalendarDays size={22} color={colors.tint} />
               </View>
               <View style={styles.scheduledInfoContent}>
                 <Text style={[styles.scheduledInfoLabel, { color: colors.icon }]}>Lembrete de Sessão</Text>
                 <Text style={[styles.scheduledDate, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                   {new Date(viewingDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                 </Text>
                 <Text style={[styles.scheduledTime, { color: colors.tint }]}>
                   às {new Date(viewingDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                 </Text>
               </View>
             </LinearGradient>
          )}

          {/* Sinopse */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sinopse</Text>
            <ExpandableText 
              text={tvShow.overview || 'Nenhuma sinopse disponível.'} 
              colors={colors} 
              style={{ color: colors.text }} 
            />
          </View>

          {/* Onde Assistir */}
          <WatchProvidersSection 
            providers={tvShow['watch/providers']?.results?.BR || tvShow['watch_providers']?.results?.BR} 
            title={tvShow.name}
            colors={colors} 
          />

          {/* Info Extra */}
          <View style={styles.infoGrid}>
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.infoLabel, { color: colors.icon }]} numberOfLines={1}>Temporadas</Text>
              <Text 
                style={[styles.infoValue, { color: colors.text }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {tvShow.number_of_seasons || '-'}
              </Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.infoLabel, { color: colors.icon }]} numberOfLines={1}>Episódios</Text>
              <Text 
                style={[styles.infoValue, { color: colors.text }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {tvShow.number_of_episodes || '-'}
              </Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.infoLabel, { color: colors.icon }]} numberOfLines={1}>Status</Text>
              <Text 
                style={[styles.infoValue, { color: colors.text }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {tvShow.status === 'Ended' ? 'Finalizada' : 'Em Exibição'}
              </Text>
            </View>
          </View>

          {/* Seleção de Temporadas (Carousel de Posters) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Temporadas</Text>
              <View style={[styles.progressBadge, { backgroundColor: colors.tint + '20' }]}>
                <Text style={[styles.progressText, { color: colors.tint }]}>
                   {(() => {
                     const totalAired = getAiredEpisodesCount(tvShow);
                     const total = totalAired > 0 ? totalAired : (tvShow.number_of_episodes || 1);
                     return Math.min(100, Math.round((watchedEpisodes.size / total) * 100));
                   })()}% concluído
                </Text>
              </View>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.seasonsCarousel}
            >
              {tvShow.seasons?.filter((s: any) => s.season_number > 0).map((season: any) => {
                const seasonNum = season.season_number;
                const episodesCount = season.episode_count;
                const watchedInSeason = (Array.from(watchedEpisodes) as string[]).filter(key => key.startsWith(`${seasonNum}-`)).length;
                const isComplete = episodesCount > 0 && watchedInSeason >= episodesCount;

                return (
                  <SeasonCard 
                    key={`season-${season.id}`} 
                    season={season}
                    posterUrl={posterUrl}
                    isComplete={isComplete}
                    isSelected={expandedSeason === season.season_number}
                    onPress={handleExpandSeason}
                    colors={colors}
                  />
                );
              })}
            </ScrollView>

            {/* Ficha da Temporada Selecionada */}
            {expandedSeason !== null && (
               <Animated.View 
                  entering={FadeIn} 
                  exiting={FadeOut}
                  style={[styles.selectedSeasonDetails, { backgroundColor: colors.surface }]}
                >
                  {(() => {
                    const selectedSeason = tvShow.seasons?.find((s: any) => s.season_number === expandedSeason);
                    if (!selectedSeason) return null;
                    
                    const isSeasonComplete = selectedSeason.episode_count > 0 && 
                      (seasonsData.get(selectedSeason.season_number)?.episodes || [])
                        .every((ep: any) => watchedEpisodes.has(`${selectedSeason.season_number}-${ep.episode_number}`));

                    return (
                      <View key="stable-season-view">
                        <View style={styles.selectedSeasonInfoRow}>
                          <Image 
                            source={{ uri: tmdbService.getImageUrl(selectedSeason.poster_path, 'w500') || undefined }} 
                            style={styles.selectedSeasonPoster}
                            transition={300}
                            contentFit="cover"
                          />
                          <View style={styles.selectedSeasonMeta}>
                             <Text style={[styles.selectedSeasonTitle, { color: colors.text }]}>{selectedSeason.name}</Text>
                             <Text style={[styles.selectedSeasonDate, { color: colors.icon }]}> 
                               Estreia: {selectedSeason.air_date ? new Date(selectedSeason.air_date).toLocaleDateString('pt-BR') : 'N/A'}
                             </Text>
                             <Text style={[styles.selectedSeasonEpCount, { color: colors.tint }]}>
                               {selectedSeason.episode_count} Episódios
                             </Text>
                             
                             <TouchableOpacity 
                                style={[styles.checkAllBtnCompact, { backgroundColor: colors.tint + '10' }]} 
                                onPress={() => toggleWholeSeason(selectedSeason)}
                              >
                                <CheckCircle2 size={16} color={colors.tint} />
                                <Text style={[styles.checkAllText, { color: colors.tint }]}>Check-in Total</Text>
                              </TouchableOpacity>
                          </View>
                        </View>
                        
                        <View style={styles.episodesListContainer}>
                          {fetchingSeason && !seasonsData.has(expandedSeason) ? (
                            <View style={{ minHeight: 100, justifyContent: 'center' }}>
                              <ActivityIndicator size="small" color={colors.tint} />
                            </View>
                          ) : (
                            seasonsData.get(expandedSeason)?.episodes.map((ep: any) => (
                              <EpisodeItem 
                                key={ep.id}
                                episode={{...ep, season_number: expandedSeason}}
                                isWatched={watchedEpisodes.has(`${expandedSeason}-${ep.episode_number}`)}
                                onToggle={toggleEpisode}
                                colors={colors}
                              />
                            ))
                          )}
                        </View>
                      </View>
                    );
                  })()}
               </Animated.View>
            )}
          </View>

          {/* Agendamento de Próxima Temporada */}
          {tvShow.next_episode_to_air && (
             <View style={[styles.nextSeasonCard, { backgroundColor: colors.surface }]}>
                <View style={styles.nextSeasonInfo}>
                   <Rocket size={24} color={colors.tint} />
                   <View>
                      <Text style={[styles.nextSeasonLabel, { color: colors.icon }]}>PRÓXIMO EPISÓDIO</Text>
                      <Text style={[styles.nextSeasonTitle, { color: colors.text }]}>
                        {new Date(tvShow.next_episode_to_air.air_date).toLocaleDateString('pt-BR')}
                      </Text>
                   </View>
                </View>
                <TouchableOpacity 
                  style={[styles.notifyBtn, { backgroundColor: colors.tint }]}
                  onPress={() => saveToAgenda(new Date(tvShow.next_episode_to_air.air_date))}
                >
                  <Text style={styles.notifyBtnText}>Me avise</Text>
                </TouchableOpacity>
             </View>
          )}

          <HistorySection 
            history={history}
            colors={colors}
            onClear={clearHistory}
            onDelete={deleteSession}
            onEdit={(session: any) => {
              setEditingSession(session);
              setShowDatePicker(true);
            }}
          />

          <CastSection 
            cast={tvShow?.aggregate_credits?.cast || tvShow?.credits?.cast} 
            colors={colors} 
            onActorPress={(actorId: any) => router.push(`/actor/${actorId}`)} 
          />

          <VideosSection 
            videos={tvShow?.videos?.results} 
            colors={colors} 
          />

          <StudiosSection 
            companies={tvShow?.production_companies} 
            colors={colors} 
          />

          <ReviewsSection 
            reviews={tvShow.reviews?.results} 
            colors={colors} 
          />

          {tvShow.recommendations?.results && tvShow.recommendations.results.length > 0 && (
            <RecommendationsSection 
              items={tvShow.recommendations.results} 
              colors={colors} 
              onPress={(m: any) => router.push(`/tv/${m.id}`)} 
              title="Sugerido para Você" 
            />
          )}

          <SimilarSeriesSection 
            similar={tvShow.similar?.results} 
            colors={colors} 
            onSeriesPress={(m: any) => router.push(`/tv/${m.id}`)} 
          />
        </View>
      </ScrollView>

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

      <CustomModal
        {...modalConfig}
        onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
