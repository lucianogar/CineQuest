import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Star, Clock, CalendarDays, Trash2, Tv, Video, Play, Newspaper, ChevronRight, Check, CheckCircle2 } from 'lucide-react-native';
import { tmdbService } from '@/services/tmdb';
import MovieCard from '@/components/MovieCard';
import { openWatchProvider } from '@/services/watchProviders';

const { width } = Dimensions.get('window');

interface SectionProps {
  colors: any;
  title?: string;
}

export const CastSection = memo(({ cast, colors, onActorPress }: { cast: any[], colors: any, onActorPress: (id: number) => void }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Elenco e Equipe</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {cast.slice(0, 15).map((actor: any, index: number) => {
          const character = actor.roles && actor.roles.length > 0 
            ? actor.roles[0].character 
            : actor.character;
            
          return (
            <TouchableOpacity 
              key={`${actor.id}-${index}`} 
              style={styles.actorCard}
              onPress={() => onActorPress(actor.id)}
            >
              <Image 
                source={{ uri: tmdbService.getImageUrl(actor.profile_path, 'w500') || undefined }} 
                style={styles.actorImage} 
                transition={300}
                contentFit="cover"
                cachePolicy="disk"
              />
              <Text style={[styles.actorName, { color: colors.text }]} numberOfLines={1}>{actor.name}</Text>
              <Text style={[styles.actorCharacter, { color: colors.icon }]} numberOfLines={1}>{character}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export const StudiosSection = memo(({ companies, colors }: { companies: any[], colors: any }) => {
  if (!companies || companies.length === 0) return null;
  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Estúdios e Produção</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {companies.map((company: any) => (
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
                <Tv size={24} color="#666" />
              )}
            </View>
            <Text style={[styles.studioName, { color: colors.text }]} numberOfLines={1}>{company.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export const VideosSection = memo(({ videos, colors }: { videos: any[], colors: any }) => {
  if (!videos || videos.length === 0) return null;
  const trailers = videos.filter((v: any) => v.type === 'Trailer' || v.type === 'Teaser');
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
                transition={300}
                contentFit="cover"
                cachePolicy="disk"
              />
              <View style={styles.playOverlay}>
                <Play size={24} color="#FFF" />
              </View>
            </View>
            <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>{video.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

export const WatchProvidersSection = memo(({ providers, title, colors }: { providers: any, title: string, colors: any }) => {
  if (!providers) return null;
  
  const list = [
    ...(providers.flatrate || []),
    ...(providers.rent || []),
    ...(providers.buy || [])
  ].reduce((acc: any[], curr: any) => {
    if (!acc.find(item => item.provider_id === curr.provider_id)) acc.push(curr);
    return acc;
  }, []);

  return (
    <View style={[styles.sectionContainer, { marginTop: 10 }]}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list.length === 0 ? (
          <Text style={{ color: colors.icon, fontStyle: 'italic', marginLeft: 5 }}>Disponível apenas em canais de TV ou mídia física.</Text>
        ) : (
          list.map((provider: any) => (
            <TouchableOpacity 
              key={provider.provider_id} 
              style={styles.providerItem}
              onPress={() => openWatchProvider(provider.provider_name, title, providers.link)}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: tmdbService.getImageUrl(provider.logo_path, 'w500') || undefined }} 
                style={styles.providerLogo} 
                transition={300}
                contentFit="cover"
                cachePolicy="disk"
              />
              <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>{provider.provider_name}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
});

export const HistorySection = memo(({ history, colors, onClear, onDelete, onEdit }: { history: any[], colors: any, onClear: () => void, onDelete: (id: string) => void, onEdit: (session: any) => void }) => {
  if (!history || history.length === 0) return null;

  return (
    <View style={[styles.historyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.historyHeader}>
        <View style={styles.historyTitleRow}>
          <Clock size={16} color={colors.tint} />
          <Text style={[styles.historyTitle, { color: colors.text }]}>Seu Histórico</Text>
        </View>
        <TouchableOpacity onPress={onClear}>
          <Text style={[styles.clearText, { color: '#EF4444' }]}>Apagar Tudo</Text>
        </TouchableOpacity>
      </View>
      {history.map((session, index) => (
        <TouchableOpacity 
          key={session.id} 
          style={[styles.historyItem, { borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }]}
          onPress={() => onEdit(session)}
        >
          <View style={styles.historyInfo}>
            <CalendarDays size={14} color={colors.icon} />
            <Text style={[styles.historyDate, { color: colors.text }]}>
              {new Date(session.added_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDelete(session.id)} style={styles.deleteBtn}>
            <Trash2 size={16} color={colors.icon} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
});

export const ReviewsSection = memo(({ reviews, colors }: { reviews: any[], colors: any }) => {
  if (!reviews || reviews.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notícias e Críticas</Text>
        <Newspaper size={20} color={colors.tint} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {reviews.slice(0, 5).map((review: any) => (
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
  );
});

export const SimilarSeriesSection = memo(({ similar, colors, onSeriesPress }: { similar: any[], colors: any, onSeriesPress: (m: any) => void }) => {
  if (!similar || similar.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Séries Relacionadas</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {similar.slice(0, 10).map((similarTv: any) => (
          <MovieCard 
            key={similarTv.id} 
            movie={{...similarTv, media_type: 'tv'}} 
            onPress={onSeriesPress} 
          />
        ))}
      </ScrollView>
    </View>
  );
});

export const RecommendationsSection = memo(({ items, colors, onPress, title, mediaType = 'tv' }: { items: any[], colors: any, onPress: (m: any) => void, title: string, mediaType?: 'movie' | 'tv' }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.slice(0, 15).map((item: any) => (
          <MovieCard 
            key={item.id} 
            movie={{...item, media_type: item.media_type || mediaType}} 
            onPress={onPress} 
          />
        ))}
      </ScrollView>
    </View>
  );
});

export const SeasonCard = memo(({ season, posterUrl, isComplete, isSelected, onPress, colors }: any) => {
  const imageUrl = tmdbService.getImageUrl(season.poster_path, 'w500') || posterUrl;
  
  return (
    <TouchableOpacity 
      style={styles.seasonCardSmall}
      onPress={() => onPress(season.season_number)}
      activeOpacity={1}
    >
      <View style={styles.seasonPosterContainer}>
        <Image 
          source={{ uri: imageUrl || undefined }} 
          style={styles.seasonPosterSmall}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={imageUrl}
        />
        
        {isSelected && (
          <View style={[styles.seasonSelectedBorder, { borderColor: colors.tint }]} />
        )}

        {isComplete && (
          <View style={[styles.seasonCheckBadge, { backgroundColor: colors.tint }]}>
            <Check size={10} color="#FFF" />
          </View>
        )}
      </View>

      <Text style={[styles.seasonLabelSmall, { color: isSelected ? colors.tint : colors.text }]} numberOfLines={1}>
        Temp. {season.season_number}
      </Text>
    </TouchableOpacity>
  );
});

export const EpisodeItem = memo(({ episode, isWatched, onToggle, colors }: { episode: any, isWatched: boolean, onToggle: (seasonNum: number, epNum: number) => void, colors: any }) => {
  return (
    <TouchableOpacity 
      style={styles.episodeRowItem}
      onPress={() => onToggle(episode.season_number, episode.episode_number)}
    >
      <View style={styles.episodeInfoShort}>
        <Text style={[styles.episodeNumSmall, { color: colors.icon }]}>{episode.episode_number}</Text>
        <Text style={[styles.episodeTitleSmall, { color: colors.text }]} numberOfLines={1}>{episode.name}</Text>
      </View>
      <View style={[styles.checkboxSmall, isWatched && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
        {isWatched && <Check size={10} color="#FFF" />}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 30 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  scrollContent: { paddingHorizontal: 5 },
  
  actorCard: { width: 110, marginRight: 15, alignItems: 'center' },
  actorImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  actorName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actorCharacter: { fontSize: 11, textAlign: 'center', marginTop: 2, opacity: 0.8 },
  
  studioCard: { width: 120, marginRight: 15, alignItems: 'center' },
  studioLogoContainer: { width: 110, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8, padding: 10, overflow: 'hidden' },
  studioLogo: { width: '100%', height: '100%' },
  studioName: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  videoCard: { width: 220, marginRight: 15 },
  videoThumbContainer: { width: 220, height: 124, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.8 },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  videoTitle: { fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 18 },

  providerItem: { alignItems: 'center', marginRight: 20, width: 60 },
  providerLogo: { width: 45, height: 45, borderRadius: 12, marginBottom: 6 },
  providerName: { fontSize: 10, textAlign: 'center', fontWeight: '500' },

  historyBox: { marginTop: 30, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { fontSize: 14, fontWeight: 'bold' },
  clearText: { fontSize: 12, fontWeight: 'bold' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  historyInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDate: { fontSize: 13 },
  deleteBtn: { padding: 5 },

  newsCard: { width: 280, padding: 15, borderRadius: 20, borderWidth: 1, marginRight: 15, minHeight: 180 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  reviewAuthor: { fontSize: 14, fontWeight: 'bold', flex: 1 },
  newsContent: { fontSize: 13, lineHeight: 18, opacity: 0.8, marginBottom: 12 },
  readMoreBtn: { alignSelf: 'flex-start' },
  readMore: { fontSize: 12, fontWeight: 'bold' },

  seasonCardSmall: { width: 90, gap: 8 },
  seasonPosterContainer: { width: 90, height: 135, borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#222' },
  seasonPosterSmall: { width: '100%', height: '100%' },
  seasonSelectedBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, borderWidth: 3, zIndex: 5 },
  seasonCheckBadge: { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, zIndex: 10 },
  seasonLabelSmall: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  episodeRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  episodeInfoShort: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  episodeNumSmall: { fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', width: 20 },
  episodeTitleSmall: { fontSize: 14, flex: 1 },
  checkboxSmall: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
});
