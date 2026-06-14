import CustomModal from '@/components/CustomModal';
import MovieCard from '@/components/MovieCard';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/services/supabase';
import { Genre, Movie, tmdbService } from '@/services/tmdb';
import { router, useFocusEffect } from 'expo-router';
import { Calendar, CheckCircle2, Filter, Grid, Library, List, Rocket, Search as SearchIcon, ChevronDown, ChevronUp, X, Star, CalendarDays } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const { session } = useAuth();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [isGroupedByGenre, setIsGroupedByGenre] = useState(false);
  
  // Estados de Edição de Data
  const [editingMovie, setEditingMovie] = useState<any>(null);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  
  // Estados de Filtros Avançados
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'movie' | 'tv' | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc'>('popularity.desc');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [userMoviesMap, setUserMoviesMap] = useState<Map<number, any>>(new Map());

  // Estados de Seleção
  const [selectedMovies, setSelectedMovies] = useState<Movie[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({ title: '', message: '', buttons: [] });
  
  const bottomBarAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    loadViewMode();
  }, []);

  const loadViewMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('@viewMode_search');
      if (savedMode) setViewMode(savedMode as 'grid' | 'timeline');
    } catch (e) {
      console.error('Error loading view mode:', e);
    }
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === 'grid' ? 'timeline' : 'grid';
    setViewMode(newMode);
    try {
      await AsyncStorage.setItem('@viewMode_search', newMode);
    } catch (e) {
      console.error('Error saving view mode:', e);
    }
  };

  useEffect(() => {
    if (selectedMovies.length > 0) {
      Animated.spring(bottomBarAnim, { toValue: 0, useNativeDriver: true, tension: 40, friction: 7 }).start();
    } else {
      Animated.spring(bottomBarAnim, { toValue: 120, useNativeDriver: true }).start();
    }
  }, [selectedMovies.length]);

  const fetchUserMovies = async () => {
    let query = supabase.from('user_movies').select('*');
    if (session) {
      query = query.eq('user_id', session.user.id);
    }
    const { data, error } = await query;
    
    if (!error && data) {
      const map = new Map();
      data.forEach((m: any) => {
        const existing = map.get(m.movie_id) || { count: 0, status: null, viewing_date: null };
        if (m.status === 'watched') {
          existing.count += 1;
        }
        if (m.status === 'wishlist') {
          existing.status = 'wishlist';
          existing.viewing_date = m.viewing_date;
        }
        map.set(m.movie_id, existing);
      });
      setUserMoviesMap(map);
    }
  };

  const fetchGenres = async () => {
    try {
      const [movieG, tvG] = await Promise.all([
        tmdbService.getMovieGenres(),
        tmdbService.getTvGenres()
      ]);
      // Unificar gêneros únicos
      const allGenres = [...movieG];
      tvG.forEach(g => {
        if (!allGenres.find(x => x.id === g.id)) allGenres.push(g);
      });
      setGenres(allGenres.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Erro ao buscar gêneros', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserMovies();
      fetchGenres();
    }, [session])
  );

  const updateViewingDate = async (movieId: number, newDate: Date) => {
    try {
      let query = supabase
        .from('user_movies')
        .update({ added_at: newDate.toISOString() });
      
      if (session) {
        query = query.eq('user_id', session.user.id);
      }

      const { error } = await query
        .eq('movie_id', movieId)
        .eq('status', 'watched');

      if (!error) {
        // Recarregar o status localmente para refletir a mudança
        const newMap = new Map(userMoviesMap);
        const current = newMap.get(movieId);
        if (current) {
          newMap.set(movieId, { ...current, viewing_date: newDate.toISOString() });
          setUserMoviesMap(newMap);
        }
      }
    } catch (e) {
      console.error('Erro ao atualizar data na busca:', e);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setIsDatePickerVisible(false);
    if (selectedDate && editingMovie) {
      updateViewingDate(editingMovie.id, selectedDate);
    }
    setEditingMovie(null);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        if (query.trim().length > 1) {
          const today = new Date().toISOString().split('T')[0];
          const multiResults = await tmdbService.searchMulti(query);
          let finalResults = [...multiResults];

          if (query.toLowerCase().trim().length >= 2) {
            const companies = await tmdbService.searchCompanies(query);
            if (companies.length > 0) {
              const isMarvelSearch = query.toLowerCase().includes('marvel');
              let bestMatch: string | number = companies[0].id;
              
              if (isMarvelSearch) {
                // Para Marvel, buscamos Marvel Studios (420) OR Marvel Entertainment (7505)
                bestMatch = '420|7505';
              }

              const mParams: any = { with_companies: bestMatch };
              const tParams: any = { with_companies: bestMatch };
              
              if (showUpcomingOnly) {
                mParams['primary_release_date.gte'] = today;
                mParams.sort_by = 'primary_release_date.asc';
                tParams['first_air_date.gte'] = today;
                tParams.sort_by = 'first_air_date.asc';
              }

              const [companyMovies, companyTv] = await Promise.all([
                tmdbService.discoverMovies(mParams),
                tmdbService.discoverTv(tParams)
              ]);
              
              const deepResults = [...companyMovies, ...companyTv];
              const existingIds = new Set(finalResults.map(m => `${m.media_type}-${m.id}`));
              const newItems = deepResults.filter(m => !existingIds.has(`${m.media_type}-${m.id}`));
              
              // Se é uma busca por empresa e estreias, coloca os resultados da empresa no TOPO
              if (showUpcomingOnly) {
                finalResults = [...newItems, ...finalResults];
              } else {
                finalResults = [...finalResults, ...newItems];
              }
            }
          }

          // Filtragem por Tipo (Filme/Série) para a busca por texto
          if (selectedType !== 'all') {
            finalResults = finalResults.filter(m => m.media_type === selectedType);
          }

          // Filtragem por Ano para a busca por texto
          if (selectedYear) {
            finalResults = finalResults.filter(m => {
              const dateStr = m.media_type === 'movie' ? m.release_date : m.first_air_date;
              return dateStr && new Date(dateStr).getFullYear() === selectedYear;
            });
          }

          // Filtragem por Gênero para a busca por texto
          if (selectedGenre) {
            finalResults = finalResults.filter(m => m.genre_ids?.includes(selectedGenre));
          }

          // Filtragem de Estreias para a busca por texto
          if (showUpcomingOnly) {
            finalResults = finalResults.filter(m => {
              const dateStr = m.media_type === 'movie' ? m.release_date : m.first_air_date;
              return dateStr && dateStr >= today;
            });
          }

          setResults(finalResults.filter(m => m.poster_path || showUpcomingOnly));
          setSearched(true);
        } else if (selectedGenre || selectedYear || selectedType !== 'all' || sortBy !== 'popularity.desc' || showUpcomingOnly) {
          // Lógica de Descoberta (Filtros)
          const params: any = { 
            sort_by: sortBy,
            with_genres: selectedGenre,
            region: 'BR',
            watch_region: 'BR',
          };
          
          const today = new Date().toISOString().split('T')[0];
          
          if (showUpcomingOnly) {
             params['primary_release_date.gte'] = today;
             params['first_air_date.gte'] = today;
             params.sort_by = 'primary_release_date.asc'; // Ordenar pelos mais próximos
          }

          if (sortBy === 'vote_average.desc') {
            params['vote_count.gte'] = 100;
          }

          if (selectedYear) {
             params.primary_release_year = selectedYear;
             params.first_air_date_year = selectedYear;
          }

          let discoverResults: Movie[] = [];
          
          if (selectedType === 'all') {
            const [m, t] = await Promise.all([
              tmdbService.discoverMovies(params),
              tmdbService.discoverTv(params)
            ]);
            discoverResults = [...m, ...t];
          } else if (selectedType === 'movie') {
            discoverResults = await tmdbService.discoverMovies(params);
          } else {
            discoverResults = await tmdbService.discoverTv(params);
          }

          if (showUpcomingOnly) {
            discoverResults = discoverResults.filter(m => {
              const dateStr = m.media_type === 'movie' ? m.release_date : m.first_air_date;
              return dateStr && dateStr >= today;
            });
          }

          setResults(discoverResults);
          setSearched(true);
        } else {
          setResults([]);
          setSearched(false);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [query, showUpcomingOnly, selectedGenre, selectedYear, selectedType, sortBy]);

  const processedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const dateAStr = a.media_type === 'movie' ? a.release_date : a.first_air_date;
      const dateBStr = b.media_type === 'movie' ? b.release_date : b.first_air_date;
      const dateA = dateAStr ? new Date(dateAStr).getTime() : 0;
      const dateB = dateBStr ? new Date(dateBStr).getTime() : 0;
      return showUpcomingOnly ? dateA - dateB : dateB - dateA;
    });
  }, [results, showUpcomingOnly]);

  const gridData = useMemo(() => {
    const isVisualTimeline = viewMode === 'timeline';
    const isTimelined = showUpcomingOnly || isVisualTimeline;
    const groups: { [key: string]: any[] } = {};
    
    // Caso 1: Agrupamento por Gênero (Prioridade sobre Timeline se ativo)
    if (isGroupedByGenre) {
      const genreGroups: { [key: string]: any[] } = {};
      processedResults.forEach(movie => {
        const gId = movie.genre_ids?.[0];
        const gName = genres.find(g => g.id === gId)?.name || 'Outros';
        if (!genreGroups[gName]) genreGroups[gName] = [];
        genreGroups[gName].push(movie);
      });
      
      const flattened: any[] = [];
      const sortedNames = Object.keys(genreGroups).sort();
      
      sortedNames.forEach(name => {
        flattened.push({ isSectionHeader: true, title: name });
        const items = genreGroups[name];
        
        if (viewMode === 'timeline') {
          items.forEach(m => flattened.push(m));
        } else {
          for (let i = 0; i < items.length; i += 2) {
            flattened.push({ isRow: true, movies: items.slice(i, i + 2) });
          }
        }
      });
      return flattened;
    }

    // Caso 2: Agrupamento Temporal (Headers de Ano)
    if (isTimelined) {
      processedResults.forEach(movie => {
        const dateStr = movie.media_type === 'movie' ? movie.release_date : movie.first_air_date;
        const year = dateStr ? dateStr.split('-')[0] : 'Indefinido';
        if (!groups[year]) groups[year] = [];
        groups[year].push(movie);
      });
      
      const flattened: any[] = [];
      const sortedYears = Object.keys(groups).sort((a, b) => {
        if (showUpcomingOnly) return a.localeCompare(b);
        return b.localeCompare(a);
      });

      sortedYears.forEach(year => {
        flattened.push({ isHeader: true, year });
        const items = groups[year];
        
        if (viewMode === 'timeline') {
          // No modo timeline, adicionamos um por um para ficar em lista
          items.forEach(m => flattened.push(m));
        } else {
          // Em outros modos (incluindo foguete/estreias se estiver em grid), agrupamos em 2
          for (let i = 0; i < items.length; i += 2) {
            flattened.push({ isRow: true, movies: items.slice(i, i + 2) });
          }
        }
      });
      return flattened;
    }

    // Caso 3: Busca Normal (Sem headers, mas em linhas de 2 para manter o tamanho compacto)
    const flattened: any[] = [];
    for (let i = 0; i < processedResults.length; i += 2) {
      flattened.push({ isRow: true, movies: processedResults.slice(i, i + 2) });
    }
    return flattened;
  }, [processedResults, showUpcomingOnly, viewMode, isGroupedByGenre, genres]);

  const toggleSelection = (movie: Movie) => {
    // Séries não são mais selecionáveis em massa (conforme pedido do usuário para abrir detalhes)
    if (movie.media_type === 'tv') {
      router.push(`/tv/${movie.id}` as any);
      return;
    }

    const isSelected = !!selectedMovies.find(m => m.id === movie.id);
    
    if (isSelected) {
      setSelectedMovies(prev => prev.filter(m => m.id !== movie.id));
      return;
    }

    // Travas de Seleção para Filmes
    if (selectedMovies.length > 0) {
       // Atualmente apenas filmes chegam aqui, então não há mistura possível
    }

    setSelectedMovies(prev => [...prev, movie]);
  };

  const selectAll = () => {
    // Selecionar apenas filmes que NÃO estão marcados como assistidos no mapa do usuário
    const selectableMovies = processedResults.filter(m => {
      if (m.media_type !== 'movie') return false;
      const userData = userMoviesMap.get(m.id);
      return !(userData && userData.count > 0);
    });
    
    if (selectedMovies.length === selectableMovies.length) {
      setSelectedMovies([]);
    } else {
      setSelectedMovies(selectableMovies);
    }
  };

  const handleBulkAction = async (status: 'watched' | 'wishlist') => {
    setModalConfig({
      type: 'info',
      title: 'Confirmar Ação',
      message: `Deseja adicionar estes ${selectedMovies.length} filme(s) à sua ${status === 'watched' ? 'coleção' : 'agenda'}?`,
      buttons: [
        { 
          text: 'Sim', 
          primary: true, 
          onPress: async () => {
            setActionLoading(true);
            try {
              const movieIds = selectedMovies.map(m => m.id);
              
              const upserts = selectedMovies.map(movie => ({
                user_id: session ? session.user.id : null,
                movie_id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                release_date: movie.release_date,
                status,
                location: status === 'wishlist' ? 'Casa' : null,
                media_type: movie.media_type as any,
                vote_average: movie.vote_average || 0,
                runtime: movie.runtime || 0,
                added_at: new Date().toISOString(),
                genre_ids: movie.genre_ids || [],
              }));

              let deleteQuery = supabase.from('user_movies').delete().eq('status', 'wishlist').in('movie_id', movieIds);
              if (session) {
                deleteQuery = deleteQuery.eq('user_id', session.user.id);
              }
              await deleteQuery;
              
              const { error } = await supabase.from('user_movies').insert(upserts);
              if (error) throw error;

              setSelectedMovies([]);
              await fetchUserMovies(); // Atualiza os dados do usuário
              
              setModalConfig({
                type: 'success',
                title: 'Sucesso!',
                message: `${selectedMovies.length} filme(s) salvos com sucesso.`,
                buttons: [{ text: 'Excelente', onPress: () => setModalVisible(false), primary: true }]
              });
            } catch (error: any) {
              setModalConfig({
                type: 'error',
                title: 'Erro',
                message: 'Erro ao processar ação.',
                buttons: [{ text: 'Entendido', onPress: () => setModalVisible(false), primary: true }]
              });
            } finally {
              setActionLoading(false);
            }
          }
        },
        { text: 'Cancelar', onPress: () => setModalVisible(false) }
      ]
    });
    setModalVisible(true);
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Explorar</Text>
          <Text style={[styles.headerSubtitle, { color: colors.icon }]}>Descubra novos títulos</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            onPress={() => setIsGroupedByGenre(!isGroupedByGenre)}
            style={[styles.viewToggle, { backgroundColor: isGroupedByGenre ? colors.tint : colors.surface }]}
          >
            <Library size={20} color={isGroupedByGenre ? '#FFF' : colors.tint} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setIsDrawerOpen(!isDrawerOpen)}
            style={[styles.viewToggle, { backgroundColor: isDrawerOpen ? colors.tint : colors.surface }]}
          >
            <Filter size={20} color={isDrawerOpen ? '#FFF' : colors.tint} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={toggleViewMode}
            style={[styles.viewToggle, { backgroundColor: viewMode === 'timeline' ? colors.tint : colors.surface }]}
          >
            {viewMode === 'grid' ? (
              <List size={20} color={colors.tint} />
            ) : (
              <Grid size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBarWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SearchIcon size={20} color={colors.icon} style={styles.searchIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={showUpcomingOnly ? "Marvel, DC, Estúdios..." : "O que você quer ver?"}
            placeholderTextColor={colors.icon}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            editable={selectedMovies.length === 0}
          />
        </View>
      </View>

        {/* Gaveta de Filtros */}
        {isDrawerOpen && (
          <Animated.View style={[styles.drawer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

            {/* Seletor de Gênero */}
            <View style={styles.drawerSection}>
              <Text style={[styles.drawerLabel, { color: colors.icon }]}>ESTILO / GÊNERO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity 
                  onPress={() => setSelectedGenre(null)}
                  style={[styles.chip, selectedGenre === null && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                >
                  <Text style={[styles.chipText, { color: selectedGenre === null ? '#FFF' : colors.text }]}>Todos</Text>
                </TouchableOpacity>
                {genres.map((g) => (
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

            {/* Seletor de Ano */}
            <View style={styles.drawerSection}>
              <Text style={[styles.drawerLabel, { color: colors.icon }]}>ANO DE LANÇAMENTO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity 
                  onPress={() => setSelectedYear(null)}
                  style={[styles.chip, selectedYear === null && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                >
                  <Text style={[styles.chipText, { color: selectedYear === null ? '#FFF' : colors.text }]}>Todos</Text>
                </TouchableOpacity>
                {[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2015, 2010].map((year) => (
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

            {/* Ativos / Limpar */}
            <View style={styles.drawerFooter}>
               {(selectedGenre || selectedYear || selectedType !== 'all') && (
                 <TouchableOpacity onPress={() => { setSelectedGenre(null); setSelectedYear(null); setSelectedType('all'); setSortBy('popularity.desc'); }} style={styles.clearBtn}>
                   <X size={14} color="#EF4444" />
                   <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>Limpar Filtros</Text>
                 </TouchableOpacity>
               )}
               <TouchableOpacity onPress={() => setIsDrawerOpen(false)} style={styles.closeDrawerBtn}>
                 <ChevronUp size={20} color={colors.text} />
               </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Filtros Rápidos (Chips fora da gaveta para acesso veloz) */}
        <View style={styles.quickFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity 
              onPress={() => {
                const isActive = selectedType === 'tv' && sortBy === 'vote_average.desc';
                if (isActive) {
                  setSelectedType('all');
                  setSortBy('popularity.desc');
                } else {
                  setSelectedType('tv');
                  setSortBy('vote_average.desc');
                  setQuery('');
                  setIsDrawerOpen(false);
                }
              }}
              style={[styles.quickChip, selectedType === 'tv' && sortBy === 'vote_average.desc' && { backgroundColor: '#6366F1', borderColor: '#6366F1' }]}
            >
              <Star size={14} color={selectedType === 'tv' && sortBy === 'vote_average.desc' ? '#FFF' : '#6366F1'} fill={selectedType === 'tv' && sortBy === 'vote_average.desc' ? '#FFF' : 'transparent'} />
              <Text style={[styles.quickChipText, { color: selectedType === 'tv' && sortBy === 'vote_average.desc' ? '#FFF' : colors.text }]}>Top 10 Séries</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                const isActive = selectedType === 'movie' && sortBy === 'vote_average.desc';
                if (isActive) {
                  setSelectedType('all');
                  setSortBy('popularity.desc');
                } else {
                  setSelectedType('movie');
                  setSortBy('vote_average.desc');
                  setQuery('');
                  setIsDrawerOpen(false);
                }
              }}
              style={[styles.quickChip, selectedType === 'movie' && sortBy === 'vote_average.desc' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}
            >
              <Star size={14} color={selectedType === 'movie' && sortBy === 'vote_average.desc' ? '#FFF' : '#F59E0B'} fill={selectedType === 'movie' && sortBy === 'vote_average.desc' ? '#FFF' : 'transparent'} />
              <Text style={[styles.quickChipText, { color: selectedType === 'movie' && sortBy === 'vote_average.desc' ? '#FFF' : colors.text }]}>Top 10 Filmes</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setShowUpcomingOnly(!showUpcomingOnly)}
              style={[styles.quickChip, showUpcomingOnly && { backgroundColor: colors.tint }]}
            >
              <Rocket size={14} color={showUpcomingOnly ? '#FFF' : colors.tint} fill={showUpcomingOnly ? '#FFF' : 'transparent'} />
              <Text style={[styles.quickChipText, { color: showUpcomingOnly ? '#FFF' : colors.text }]}>Estreias</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                const cy = new Date().getFullYear();
                if (selectedYear === cy) {
                  setSelectedYear(null);
                  setSortBy('popularity.desc');
                } else {
                  setSelectedYear(cy);
                  setSortBy('vote_average.desc');
                  setQuery('');
                  setIsDrawerOpen(false);
                }
              }}
              style={[styles.quickChip, selectedYear === new Date().getFullYear() && { backgroundColor: '#10B981' }]}
            >
              <Calendar size={14} color={selectedYear === new Date().getFullYear() ? '#FFF' : '#10B981'} />
              <Text style={[styles.quickChipText, { color: selectedYear === new Date().getFullYear() ? '#FFF' : colors.text }]}>Melhores de {new Date().getFullYear()}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.infoRow}>
          {selectedMovies.length > 0 ? (
            <Text style={[styles.selectionCount, { color: colors.tint }]}>{selectedMovies.length} selecionados</Text>
          ) : null}
        </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : processedResults.length > 0 ? (
        <View style={{ flex: 1 }}>
          {(viewMode === 'timeline') && (
            <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
          )}
          <FlatList
            data={gridData}
          keyExtractor={(item, index) => {
            if (item.isSectionHeader) return `gh-${item.title}`;
            if (item.isHeader) return `h-${item.year}`;
            if (item.isRow) return `r-${index}`;
            return item.id.toString();
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={1}
          key={`${showUpcomingOnly}-${viewMode}-${isGroupedByGenre}`}
          columnWrapperStyle={undefined}
          renderItem={({ item }) => {
            if (item.isSectionHeader) {
               return (
                <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                  <Text style={[styles.sectionHeaderText, { color: colors.tint }]}>{item.title}</Text>
                  <View style={[styles.headerLine, { backgroundColor: colors.tint + '30' }]} />
                </View>
               );
            }
            const isVisualTimeline = viewMode === 'timeline';
            
            // Lógica de Desabilitação para Seleção (Calculada uma vez por item)
            const isSelectionActive = selectedMovies.length > 0;
            const firstType = isSelectionActive ? selectedMovies[0].media_type : null;
            
            // Função para checar se o item deve estar desabilitado
            const checkDisabled = (m: any) => {
              if (!isSelectionActive) return false;
              // Se já selecionou algo (sempre filme agora), as séries sempre abrem detalhes
              if (m.media_type === 'tv') return false; 
              
              // Filmes NUNCA são desabilitados durante a seleção de outros filmes,
              // mesmo que já tenham sido assistidos. Deseja-se permitir re-watches manuais.
              return false;
            };

            const isDisabled = item.isRow ? false : checkDisabled(item);
            // Para as linhas, precisamos checar cada filme internamente
            if (item.isHeader) {
              return (
                <View style={[styles.sectionHeader, isVisualTimeline && styles.timelineHeader]}>
                  {isVisualTimeline && <View style={[styles.timelineDot, { backgroundColor: colors.tint }]} />}
                  <Text style={[styles.sectionHeaderText, { color: colors.text }]}>{item.year}</Text>
                  {!isVisualTimeline && <View style={[styles.headerLine, { backgroundColor: colors.border }]} />}
                </View>
              );
            }

            if (item.isRow) {
              return (
                <View style={styles.row}>
                  {item.movies.map((movie: any) => {
                    const userData = userMoviesMap.get(movie.id);
                    const movieRoute = movie.media_type === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`;
                    return (
                      <View key={movie.id} style={[styles.cardContainerGrid, { opacity: isDisabled ? 0.3 : 1 }]}>
                        <View style={styles.cardWrapper}>
                          <MovieCard 
                            movie={movie} 
                            onPress={() => {
                              if (movie.media_type === 'tv') {
                                router.push(`/tv/${movie.id}` as any);
                                return;
                              }
                              selectedMovies.length > 0 ? toggleSelection(movie) : router.push(movieRoute as any);
                            }}
                            onLongPress={() => {
                              if (movie.media_type === 'tv') {
                                router.push(`/tv/${movie.id}` as any);
                                return;
                              }
                              toggleSelection(movie);
                            }}
                            selected={selectedMovies.some(sm => sm.id === movie.id)}
                            width={'100%'}
                            height={250}
                            variant={isVisualTimeline ? 'timeline' : 'grid'}
                            userStatus={userData?.status}
                            watchedCount={userData?.count}
                            viewingDate={userData?.viewing_date}
                          />
                          
                          {userData?.status === 'watched' && (
                            <TouchableOpacity 
                              onPress={() => {
                                setEditingMovie(movie);
                                setIsDatePickerVisible(true);
                              }}
                              style={styles.dateOverlayGradient}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.8)']}
                                style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 8 }}
                              >
                                <View style={styles.dateOverlayPill}>
                                  <CalendarDays size={10} color="#10B981" />
                                  <Text style={styles.overlayText}>
                                    {userData.viewing_date 
                                      ? new Date(userData.viewing_date).toLocaleDateString('pt-BR') 
                                      : 'ASSISTIDO'}
                                  </Text>
                                </View>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}

                          {userData?.status === 'wishlist' && (
                            <View style={styles.wishlistBadgeGrid}>
                              <Text style={styles.overlayText}>📌 NA AGENDA</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {item.movies.length === 1 && <View style={styles.cardContainer} />}
                </View>
              );
            }

            // Modo Timeline (Individual por linha)
            const userData = userMoviesMap.get(item.id);
            const itemRoute = item.media_type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`;
            return (
              <View style={[styles.standardCard, isVisualTimeline && styles.timelineCard, { opacity: isDisabled ? 0.3 : 1 }]}>
                <MovieCard 
                  movie={item} 
                  onPress={() => {
                    if (item.media_type === 'tv') {
                      router.push(`/tv/${item.id}` as any);
                      return;
                    }
                    selectedMovies.length > 0 ? toggleSelection(item) : router.push(itemRoute as any);
                  }}
                  onLongPress={() => {
                    if (item.media_type === 'tv') {
                      router.push(`/tv/${item.id}` as any);
                      return;
                    }
                    toggleSelection(item);
                  }}
                  selected={!!selectedMovies.find(m => m.id === item.id)}
                  variant={isVisualTimeline ? 'timeline' : 'grid'}
                  width="100%"
                  height={isVisualTimeline ? 110 : 250}
                  userStatus={userData?.status}
                  watchedCount={userData?.count}
                  viewingDate={userData?.viewing_date}
                />
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
        </View>
      ) : searched && query.length > 0 ? (
        <View style={styles.centerContainer}>
          <Filter size={50} color={colors.border} />
          <Text style={[styles.emptySubtitle, { color: colors.icon }]}>Nada encontrado.</Text>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Rocket size={60} color={colors.border} opacity={0.3} />
          <Text style={[styles.emptySubtitle, { color: colors.icon }]}>Busque o futuro.</Text>
        </View>
      )}

      {/* Barra de Ações em Massa */}
      <Animated.View style={[
        styles.selectionBar, 
        { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateY: bottomBarAnim }] }
      ]}>
        <TouchableOpacity style={styles.actionBarBtn} onPress={selectAll}>
          <CheckCircle2 size={18} color={
            selectedMovies.length > 0 && 
            selectedMovies.length === processedResults.filter(m => {
              const userData = userMoviesMap.get(m.id);
              return m.media_type === 'movie' && !(userData && userData.count > 0);
            }).length 
            ? colors.tint : colors.icon
          } />
          <Text style={[styles.actionBtnText, { 
            color: selectedMovies.length > 0 && 
            selectedMovies.length === processedResults.filter(m => {
              const userData = userMoviesMap.get(m.id);
              return m.media_type === 'movie' && !(userData && userData.count > 0);
            }).length 
            ? colors.tint : colors.icon 
          }]}>Tudo</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.actionBarBtn, styles.actionPrimaryBtn]} onPress={() => handleBulkAction('wishlist')} disabled={actionLoading}>
          <Calendar size={18} color={colors.tint} />
          <Text style={[styles.actionBtnText, { color: colors.tint }]}>Agenda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBarBtn, styles.actionWatchBtn, { backgroundColor: colors.tint }]} onPress={() => handleBulkAction('watched')} disabled={actionLoading}>
          <Library size={18} color="#FFF" />
          <Text style={styles.watchBtnText}>Assistido</Text>
        </TouchableOpacity>
      </Animated.View>

      <CustomModal visible={modalVisible} onClose={() => setModalVisible(false)} {...modalConfig} />
      {isDatePickerVisible && (
        <DateTimePicker
          value={editingMovie?.viewing_date ? new Date(editingMovie.viewing_date) : new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13, opacity: 0.8 },
  viewToggle: { padding: 10, borderRadius: 12 },
  searchBarWrapper: { paddingHorizontal: 15, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingLeft: 15, paddingRight: 8, height: 54, gap: 10 },
  searchIcon: { opacity: 0.5 },
  input: { flex: 1, fontSize: 15, height: '100%' },
  actionButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionIconBtn: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  infoRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 16 },
  selectionCount: { fontSize: 13, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptySubtitle: { fontSize: 16, textAlign: 'center', marginTop: 15, opacity: 0.6 },
  listContent: { paddingHorizontal: 10, paddingBottom: 110 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  standardCard: { flex: 1, padding: 4, position: 'relative' },
  cardContainer: { width: '49%', position: 'relative' },
  cardContainerGrid: { width: '49%', position: 'relative' },
  sectionHeader: { marginTop: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5 },
  timelineHeader: { marginLeft: 16, paddingHorizontal: 0, marginBottom: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, zIndex: 10 },
  sectionHeaderText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5, opacity: 0.9 },
  headerLine: { flex: 1, height: 1, opacity: 0.1 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, left: 21, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', opacity: 0.3, zIndex: -1 },
  timelineCard: { marginLeft: 40, paddingRight: 15, marginBottom: 15 },
  timelineRowFix: { flexDirection: 'column', gap: 10 },
  selectionBar: { position: 'absolute', bottom: 25, left: 15, right: 15, height: 64, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, zIndex: 1000 },
  actionBarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 44, justifyContent: 'center' },
  actionPrimaryBtn: { paddingHorizontal: 12 },
  actionWatchBtn: { flex: 1, borderRadius: 14, minWidth: 110 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  watchBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  cardWrapper: { width: '100%', position: 'relative', borderRadius: 12, overflow: 'hidden' },
  dateOverlayGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 8, zIndex: 100 },
  dateOverlayPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  overlayText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  wishlistBadgeGrid: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 20 },
  drawer: { marginTop: 15, padding: 15, borderRadius: 20, borderWidth: 1, gap: 20 },
  drawerSection: { gap: 12 },
  drawerLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipText: { fontSize: 13, fontWeight: '600' },
  drawerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closeDrawerBtn: { padding: 5 },
  quickFilters: { marginTop: 15, height: 36 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  quickChipText: { fontSize: 12, fontWeight: 'bold' }
});
