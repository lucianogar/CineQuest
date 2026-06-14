import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, DimensionValue } from 'react-native';
import { Image } from 'expo-image';
import { Movie, tmdbService } from '@/services/tmdb';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Star, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  movie: Movie;
  onPress: (movie: Movie) => void;
  onLongPress?: (movie: Movie) => void;
  width?: DimensionValue;
  height?: DimensionValue;
  variant?: 'grid' | 'timeline';
  selected?: boolean;
  userStatus?: 'watched' | 'wishlist' | 'watching' | null;
  watchedCount?: number;
  viewingDate?: string | null;
  progress?: number;
}

const MovieCard = React.memo(({ 
  movie, 
  onPress, 
  onLongPress,
  width = 140, 
  height = 210, 
  variant = 'grid',
  selected = false,
  userStatus = null,
  watchedCount = 0,
  viewingDate = null,
  progress = 0
}: Props) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const imageUrl = tmdbService.getImageUrl(movie.poster_path);

  const Container = (props: any) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(movie)}
      onLongPress={() => onLongPress?.(movie)}
      {...props}
    />
  );

  if (variant === 'timeline') {
    return (
      <Container style={[
        styles.timelineContainer, 
        { backgroundColor: colors.surface, borderColor: selected ? colors.tint : colors.border },
        selected && { borderWidth: 2 }
      ]}>
        {/* Barra Lateral de Indicação */}
        <View style={[
          styles.indicatorBar, 
          { backgroundColor: movie.media_type === 'tv' ? '#6366F1' : '#F59E0B' }
        ]} />
        
        <View style={styles.posterWrapper}>
          <Image 
            source={{ uri: imageUrl || undefined }} 
            style={styles.timelinePoster} 
            transition={300}
            contentFit="cover"
          />
          
          {/* Status Badges over Poster */}
          <View style={styles.gridBadgeContainer}>
            {watchedCount > 0 && (
              <View style={[styles.miniBadge, { backgroundColor: colors.tint }]}>
                <Text style={styles.miniBadgeText}>{watchedCount}x</Text>
              </View>
            )}
            {userStatus === 'wishlist' && viewingDate && (
              <View style={[styles.miniBadge, { backgroundColor: '#10B981' }]}>
                <CheckCircle2 size={10} color="#FFF" />
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.timelineInfo}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.timelineTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {movie.title || movie.name}
            </Text>
            {userStatus === 'wishlist' && viewingDate && (
              <Text style={{ fontSize: 10, color: '#10B981', fontWeight: 'bold', marginLeft: 8 }}>
                {new Date(viewingDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            )}
          </View>
          
          <View style={styles.timelineMeta}>
             <View style={styles.ratingBadge}>
                <Star size={10} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingText}>{movie.vote_average?.toFixed(1)}</Text>
             </View>
             <Text style={{ color: colors.icon, fontSize: 12 }}>•</Text>
             <Text style={{ color: colors.icon, fontSize: 12 }}>
               {movie.media_type === 'tv' 
                 ? (movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : 'TBA')
                 : (movie.release_date ? new Date(movie.release_date).getFullYear() : 'TBA')}
             </Text>
          </View>
          
          <Text style={[styles.timelineOverview, { color: colors.icon }]} numberOfLines={2}>
            {movie.overview || 'Sinopse não disponível.'}
          </Text>
        </View>

        {selected && (
          <View style={styles.selectionOverlay}>
            <CheckCircle2 size={24} color={colors.tint} fill="#FFF" />
          </View>
        )}
      </Container>
    );
  }

  return (
    <Container style={[
      styles.container, 
      { width, height },
      selected && { borderWidth: 3, borderColor: colors.tint }
    ]}>
      {imageUrl ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.poster} 
          transition={300}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.poster, styles.placeholder, { backgroundColor: colors.border }]}>
          <Text style={{ color: colors.icon }}>Sem Capa</Text>
        </View>
      )}

      {/* Barra Lateral de Indicação (Overlay para Grid) */}
      <View style={[
        styles.indicatorBarAbsolute, 
        { backgroundColor: movie.media_type === 'tv' ? '#6366F1' : '#F59E0B' }
      ]} />

      {selected && (
        <View style={styles.selectionOverlay}>
          <CheckCircle2 size={28} color={colors.tint} fill="#FFF" />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.ratingContainer}>
          <Star size={12} color="#FBBF24" fill="#FBBF24" />
          <Text style={styles.ratingText}>{movie.vote_average ? movie.vote_average.toFixed(1) : '-'}</Text>
        </View>
      </LinearGradient>

      {progress > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` as DimensionValue, backgroundColor: colors.tint }]} />
        </View>
      )}

      {/* Grid Badges */}
      <View style={styles.gridBadgeContainer}>
        {movie.media_type === 'tv' && (
          <View style={[styles.miniBadge, { backgroundColor: '#6366F1' }]}>
            <Text style={styles.miniBadgeText}>Série</Text>
          </View>
        )}
        {movie.media_type === 'movie' && (
          <View style={[styles.miniBadge, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.miniBadgeText}>Filme</Text>
          </View>
        )}
        {userStatus === 'watching' && (
          <View style={[styles.miniBadge, { backgroundColor: '#3B82F6' }]}>
            <CheckCircle2 size={10} color="#FFF" />
            <Text style={styles.miniBadgeText}>Assistindo</Text>
          </View>
        )}
        {watchedCount > 0 && (
          <View style={[styles.miniBadge, { backgroundColor: colors.tint }]}>
            <Text style={styles.miniBadgeText}>{watchedCount}x</Text>
          </View>
        )}
        {userStatus === 'wishlist' && viewingDate && (
          <View style={[styles.miniBadge, { backgroundColor: '#10B981' }]}>
            <CheckCircle2 size={10} color="#FFF" />
          </View>
        )}
      </View>
    </Container>
  );
});

export default MovieCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    position: 'relative',
  },
  poster: { width: '100%', height: '100%' },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, justifyContent: 'flex-end', padding: 8 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    zIndex: 20,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  miniBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarFill: {
    height: '100%',
  },

  // Estilo Linha do Tempo / Lista
  timelineContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    height: 110,
    flex: 1,
    position: 'relative',
  },
  timelinePoster: {
    width: 85,
    height: '100%',
  },
  posterWrapper: {
    width: 85,
    height: '100%',
    position: 'relative',
  },
  timelineInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  timelineOverview: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  indicatorBar: {
    width: 6,
    height: '100%',
  },
  indicatorBarAbsolute: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    zIndex: 30,
  }
});
