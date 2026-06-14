import CustomModal from '@/components/CustomModal';
import MovieCard from '@/components/MovieCard';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/services/supabase';
import { router, useFocusEffect } from 'expo-router';
import { cancelMovieAlerts } from '@/services/notifications';
import { CalendarDays, CheckCircle2, Clock, Grid, Library, List, MapPin, Trash2, Tv, Filter, X, ChevronUp } from 'lucide-react-native';
import { Search as SearchIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tmdbService } from '@/services/tmdb';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AgendaScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const { session } = useAuth();

  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGroupedByGenre, setIsGroupedByGenre] = useState(false);
  
  // Estados de Filtros Avançados
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'movie' | 'tv' | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [genresList, setGenresList] = useState<any[]>([]);

  // Estados de Seleção
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({ title: '', message: '', buttons: [] });
  
  const bottomBarAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    loadViewMode();
  }, []);

  const loadViewMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('@viewMode_agenda');
      if (savedMode) setViewMode(savedMode as 'grid' | 'list');
    } catch (e) {
      console.error('Error loading view mode:', e);
    }
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    try {
      await AsyncStorage.setItem('@viewMode_agenda', newMode);
    } catch (e) {
      console.error('Error saving view mode:', e);
    }
  };

  useEffect(() => {
    if (selectedIds.length > 0) {
      Animated.spring(bottomBarAnim, { toValue: 0, useNativeDriver: true, tension: 40, friction: 7 }).start();
    } else {
      Animated.spring(bottomBarAnim, { toValue: 120, useNativeDriver: true }).start();
    }
  }, [selectedIds.length]);

  const fetchMovies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_movies')
      .select('*')
      .eq('status', 'wishlist')
      .order('viewing_date', { ascending: true, nullsFirst: false })
      .order('added_at', { ascending: false });

    if (!error && data) {
      setMovies(data);
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  const fetchGenres = async () => {
    try {
      const [mG, tG] = await Promise.all([tmdbService.getMovieGenres(), tmdbService.getTvGenres()]);
      const combined = [...mG];
      tG.forEach(g => { if (!combined.find(x => x.id === g.id)) combined.push(g); });
      setGenresList(combined.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Erro ao buscar gêneros na agenda:', e);
    }
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  const yearsList = useMemo(() => {
    const years = new Set<number>();
    movies.forEach(m => {
      if (m.release_date) {
        const y = new Date(m.release_date).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [movies]);

  useFocusEffect(
    useCallback(() => {
      fetchMovies();
    }, [session])
  );

  const filteredMovies = useMemo(() => {
    let result = movies;

    if (searchQuery.trim()) {
      result = result.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (selectedType !== 'all') {
      result = result.filter(m => m.media_type === selectedType);
    }

    if (selectedYear) {
      result = result.filter(m => m.release_date && new Date(m.release_date).getFullYear() === selectedYear);
    }

    if (selectedGenre) {
      result = result.filter(m => m.genre_ids && m.genre_ids.includes(selectedGenre));
    }

    return result;
  }, [movies, searchQuery, selectedType, selectedYear, selectedGenre]);

  const gridData = useMemo(() => {
    if (isGroupedByGenre) {
      const groups: { [key: string]: any[] } = {};
      filteredMovies.forEach(movie => {
        const gId = movie.genre_ids?.[0];
        const gName = genresList.find(g => g.id === gId)?.name || 'Outros';
        if (!groups[gName]) groups[gName] = [];
        groups[gName].push(movie);
      });
      
      const flattened: any[] = [];
      const sortedNames = Object.keys(groups).sort();
      
      sortedNames.forEach(name => {
        flattened.push({ isSectionHeader: true, title: name });
        const items = groups[name];
        
        if (viewMode === 'list') {
          // No modo lista, itens individuais (linha única)
          items.forEach(m => flattened.push(m));
        } else {
          // No modo grid, em linhas de 2
          for (let i = 0; i < items.length; i += 2) {
            flattened.push({ isRow: true, movies: items.slice(i, i + 2) });
          }
        }
      });
      return flattened;
    }

    if (viewMode === 'list') return filteredMovies;

    const flattened: any[] = [];
    for (let i = 0; i < filteredMovies.length; i += 2) {
      flattened.push({ isRow: true, movies: filteredMovies.slice(i, i + 2) });
    }
    return flattened;
  }, [filteredMovies, isGroupedByGenre, viewMode, genresList]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === movies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(movies.map(m => m.id));
    }
  };

  const handleBulkDelete = async () => {
    setModalConfig({
      type: 'warning',
      title: 'Remover da Agenda?',
      message: `Deseja remover ${selectedIds.length} filme(s) da sua agenda permanentemente?`,
      buttons: [
        { 
          text: 'Sim', 
          destructive: true, 
          onPress: async () => {
            setActionLoading(true);
            const { error } = await supabase.from('user_movies').delete().in('id', selectedIds);
            if (!error) {
              // Cancelar notificações dos filmes removidos
              const deletedMovies = movies.filter(m => selectedIds.includes(m.id));
              for (const m of deletedMovies) {
                await cancelMovieAlerts(Number(m.movie_id));
              }

              setSelectedIds([]);
              fetchMovies();
            }
            setActionLoading(false);
          }
        },
        { text: 'Cancelar', onPress: () => setModalVisible(false) }
      ]
    });
    setModalVisible(true);
  };

  const handleBulkMarkAsWatched = async () => {
    setModalConfig({
      type: 'info',
      title: 'Mover para Coleção?',
      message: `Deseja marcar ${selectedIds.length} filme(s) como assistidos agora?`,
      buttons: [
        { 
          text: 'Sim', 
          primary: true, 
          onPress: async () => {
            setActionLoading(true);
            const selectedMovies = movies.filter(m => selectedIds.includes(m.id));
            
            // 1. Deletar da Agenda (removemos apenas o status 'wishlist')
            await supabase.from('user_movies').delete().eq('user_id', session?.user.id).eq('status', 'wishlist').in('id', selectedIds);
            
            // 2. Inserir na Coleção (Sempre cria um novo registro histórico 'watched')
            const updates = selectedMovies.map(m => ({
               user_id: session?.user.id,
               movie_id: m.movie_id,
               title: m.title,
               poster_path: m.poster_path,
               release_date: m.release_date,
               status: 'watched',
               location: null,
               added_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('user_movies').insert(updates);
            
            if (!error) {
              // Cancelar notificações dos filmes movidos
              for (const m of selectedMovies) {
                await cancelMovieAlerts(Number(m.movie_id));
              }

              setSelectedIds([]);
              fetchMovies();
            }
            setActionLoading(false);
          }
        },
        { text: 'Agora não', onPress: () => setModalVisible(false) }
      ]
    });
    setModalVisible(true);
  };

  if (loading && movies.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sua Agenda</Text>
          <Text style={[styles.headerSubtitle, { color: colors.icon }]}>
            {movies.length} títulos, {movies.filter(m => m.viewing_date).length} com alerta 🔔 {!session && '• Modo Local 💾'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            onPress={() => setIsGroupedByGenre(!isGroupedByGenre)}
            style={[styles.viewToggle, { backgroundColor: isGroupedByGenre ? colors.tint : colors.surface }]}
          >
            <Library size={20} color={isGroupedByGenre ? '#FFF' : colors.tint} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={toggleViewMode}
            style={[styles.viewToggle, { backgroundColor: viewMode === 'list' ? colors.tint : colors.surface }]}
          >
            {viewMode === 'grid' ? (
              <List size={20} color={colors.tint} />
            ) : (
              <Grid size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Gaveta de Filtros */}
      {isDrawerOpen && (
        <View style={[styles.drawer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Seletor de Tipo */}
          <View style={styles.drawerSection}>
            <Text style={[styles.drawerLabel, { color: colors.icon }]}>MOSTRAR</Text>
            <View style={styles.chipRow}>
              {['all', 'movie', 'tv'].map((type) => (
                <TouchableOpacity 
                  key={type}
                  onPress={() => setSelectedType(type as any)}
                  style={[styles.chip, selectedType === type && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                >
                  <Text style={[styles.chipText, { color: selectedType === type ? '#FFF' : colors.text }]}>
                    {type === 'all' ? 'Tudo' : type === 'movie' ? 'Filmes' : 'Séries'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Seletor de Ano */}
          {yearsList.length > 0 && (
            <View style={styles.drawerSection}>
              <Text style={[styles.drawerLabel, { color: colors.icon }]}>ANO DE LANÇAMENTO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity 
                  onPress={() => setSelectedYear(null)}
                  style={[styles.chip, selectedYear === null && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                >
                  <Text style={[styles.chipText, { color: selectedYear === null ? '#FFF' : colors.text }]}>Todos</Text>
                </TouchableOpacity>
                {yearsList.map((year) => (
                  <TouchableOpacity 
                    key={year}
                    onPress={() => setSelectedYear(year)}
                    style={[styles.chip, selectedYear === year && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                  >
                    <Text style={[styles.chipText, { color: selectedYear === year ? '#FFF' : colors.text }]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Seletor de Gênero */}
          <View style={styles.drawerSection}>
            <Text style={[styles.drawerLabel, { color: colors.icon }]}>GÊNERO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <TouchableOpacity 
                onPress={() => setSelectedGenre(null)}
                style={[styles.chip, selectedGenre === null && { backgroundColor: colors.tint, borderColor: colors.tint }]}
              >
                <Text style={[styles.chipText, { color: selectedGenre === null ? '#FFF' : colors.text }]}>Todos</Text>
              </TouchableOpacity>
              {genresList.map((g) => (
                <TouchableOpacity 
                  key={g.id}
                  onPress={() => setSelectedGenre(g.id)}
                  style={[styles.chip, selectedGenre === g.id && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                >
                  <Text style={[styles.chipText, { color: selectedGenre === g.id ? '#FFF' : colors.text }]}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.drawerFooter}>
             {(selectedGenre || selectedYear || selectedType !== 'all') && (
               <TouchableOpacity onPress={() => { setSelectedGenre(null); setSelectedYear(null); setSelectedType('all'); }} style={styles.clearBtn}>
                 <X size={14} color="#EF4444" />
                 <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>Limpar Filtros</Text>
               </TouchableOpacity>
             )}
             <TouchableOpacity onPress={() => setIsDrawerOpen(false)} style={styles.closeDrawerBtn}>
               <ChevronUp size={20} color={colors.text} />
             </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Barra de Busca Interna */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SearchIcon size={18} color={colors.icon} style={styles.searchIcon} />
          <TextInput
            placeholder="Pesquisar na agenda..."
            placeholderTextColor={colors.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: colors.tint, fontWeight: 'bold', fontSize: 12 }}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {filteredMovies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CalendarDays size={64} color={colors.border} style={{ marginBottom: 20 }} />
          <Text style={[styles.subtitle, { color: colors.icon }]}>
             {searchQuery ? 'Nenhum agendamento encontrado.' : 'Nenhum filme planejado no momento.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={gridData}
          keyExtractor={(item, index) => {
            if (item.isSectionHeader) return `gh-${item.title}`;
            if (item.isRow) return `r-${index}`;
            return item.id;
          }}
          numColumns={1}
          key={`${viewMode}-${isGroupedByGenre}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.isSectionHeader) {
               return (
                <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                  <Text style={[styles.sectionHeaderText, { color: colors.tint }]}>{item.title}</Text>
                  <View style={[styles.headerLine, { backgroundColor: colors.tint + '30' }]} />
                </View>
               );
            }

            if (item.isRow) {
               return (
                <View style={styles.row}>
                  {item.movies.map((movie: any) => (
                    <View key={movie.id} style={styles.cardContainerGrid}>
                      <View style={styles.cardWrapper}>
                        <MovieCard 
                          movie={{
                            id: movie.movie_id,
                            title: movie.title,
                            poster_path: movie.poster_path,
                            backdrop_path: null,
                            release_date: movie.release_date || '',
                            vote_average: movie.vote_average || 0,
                            runtime: movie.runtime || 0,
                            overview: movie.overview || '',
                            genre_ids: [],
                            media_type: movie.media_type as any
                          }}
                          onPress={() => {
                            if (selectedIds.length > 0) {
                              toggleSelection(movie.id);
                            } else {
                              const route = movie.media_type === 'tv' ? `/tv/${movie.movie_id}` : `/movie/${movie.movie_id}`;
                              router.push(route as any);
                            }
                          }}
                          onLongPress={() => toggleSelection(movie.id)}
                          selected={selectedIds.includes(movie.id)}
                          width={'100%'}
                          height={250}
                          variant={'grid'}
                        />
                        {movie.location && (
                          <View style={[styles.locationOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                            {movie.location === 'Cinema' ? <MapPin size={12} color="#EF4444" fill="#EF4444" /> : <Tv size={12} color="#6366F1" fill="#6366F1" />}
                            <Text style={styles.overlayText}>{movie.location}</Text>
                          </View>
                        )}
                        {movie.viewing_date ? (
                          <View style={styles.dateOverlayGradientAbsolute}>
                            <View style={styles.dateOverlayPill}>
                              <Clock size={10} color="#10B981" />
                              <Text style={styles.overlayText}>
                                {new Date(movie.viewing_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {new Date(movie.viewing_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.wishlistBadgeGrid}>
                             <Text style={styles.overlayText}>📌 QUERO ASSISTIR</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  {item.movies.length === 1 && <View style={styles.cardContainerGrid} />}
                </View>
               );
            }

            // Modo Lista (Individual por linha)
            return (
              <View style={styles.cardContainerList}>
                <View style={styles.cardWrapper}>
                  <MovieCard 
                    movie={{
                      id: item.movie_id,
                      title: item.title,
                      poster_path: item.poster_path,
                      backdrop_path: null,
                      release_date: item.release_date || '',
                      vote_average: item.vote_average || 0,
                      runtime: item.runtime || 0,
                      overview: item.overview || '',
                      genre_ids: [],
                      media_type: item.media_type as any
                    }}
                    onPress={() => {
                      if (selectedIds.length > 0) {
                        toggleSelection(item.id);
                      } else {
                        const route = item.media_type === 'tv' ? `/tv/${item.movie_id}` : `/movie/${item.movie_id}`;
                        router.push(route as any);
                      }
                    }}
                    onLongPress={() => toggleSelection(item.id)}
                    selected={selectedIds.includes(item.id)}
                    width={'100%'}
                    height={120}
                    variant={'timeline'}
                  />
                  {item.location && (
                    <View style={[styles.locationOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                      {item.location === 'Cinema' ? <MapPin size={12} color="#EF4444" fill="#EF4444" /> : <Tv size={12} color="#6366F1" fill="#6366F1" />}
                      <Text style={styles.overlayText}>{item.location}</Text>
                    </View>
                  )}
                  {item.viewing_date ? (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.dateOverlayGradient}
                    >
                      <View style={styles.dateOverlayPill}>
                        <Clock size={10} color="#10B981" />
                        <Text style={styles.overlayText}>
                          {new Date(item.viewing_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {new Date(item.viewing_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.wishlistBadgeList}>
                       <Text style={styles.overlayText}>📌 QUERO ASSISTIR</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Barra de Ações em Massa */}
      <Animated.View style={[
        styles.selectionBar, 
        { 
          backgroundColor: colors.surface, 
          borderColor: colors.border,
          transform: [{ translateY: bottomBarAnim }] 
        }
      ]}>
        <TouchableOpacity style={styles.actionBarBtn} onPress={selectAll}>
          <CheckCircle2 size={18} color={selectedIds.length === movies.length ? colors.tint : colors.icon} />
          <Text style={[styles.actionBtnText, { color: selectedIds.length === movies.length ? colors.tint : colors.icon }]}>Tudo</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.actionBarBtn} onPress={handleBulkDelete} disabled={actionLoading}>
          <Trash2 size={18} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Remover</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBarBtn, styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={handleBulkMarkAsWatched} disabled={actionLoading}>
          <Library size={18} color="#FFF" />
          <Text style={styles.primaryBtnText}>Assistido</Text>
        </TouchableOpacity>
      </Animated.View>

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        {...modalConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13, opacity: 0.8 },
  viewToggle: { padding: 10, borderRadius: 12 },
  searchContainer: { paddingHorizontal: 15, marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, gap: 10 },
  searchIcon: { opacity: 0.5 },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', opacity: 0.7 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { paddingHorizontal: 10, paddingBottom: 100 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  cardContainerGrid: { width: '49%', marginBottom: 20 },
  cardWrapper: { width: '100%', position: 'relative', borderRadius: 12, overflow: 'hidden' },
  locationOverlay: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 20 },
  dateOverlayGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 8, zIndex: 15 },
  dateOverlayPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  overlayText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  cardContainerList: { width: '100%', marginBottom: 15 },
  spacer: { flex: 1 },
  
  // Barra de Seleção
  selectionBar: {
    position: 'absolute',
    bottom: 25,
    left: 15,
    right: 15,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  actionBarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 44, justifyContent: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: { flex: 1, borderRadius: 14, minWidth: 110 },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  // Estilos da Gaveta de Filtros
  drawer: { padding: 15, borderBottomWidth: 1, gap: 15, position: 'relative', zIndex: 100 },
  drawerSection: { gap: 8 },
  drawerLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipText: { fontSize: 12, fontWeight: '500' },
  drawerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closeDrawerBtn: { padding: 5 },
  sectionHeader: { marginTop: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5 },
  sectionHeaderText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5, opacity: 0.9 },
  headerLine: { flex: 1, height: 1, opacity: 0.1 },
  dateOverlayGradientAbsolute: { position: 'absolute', bottom: 10, right: 10, zIndex: 20 },
  wishlistBadgeGrid: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 20 },
  wishlistBadgeList: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 20 },
});
