import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { tmdbService } from '@/services/tmdb';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ArrowLeft } from 'lucide-react-native';
import MovieCard from '@/components/MovieCard';

export default function ActorDetailsScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];

  const [actor, setActor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      try {
        const data = await tmdbService.getActorDetails(Number(id));
        setActor(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadDetails();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!actor) return null;

  const profileUrl = tmdbService.getImageUrl(actor.profile_path, 'w500');
  
  // Extrair créditos combinados (filmes e séries)
  const credits = actor.combined_credits?.cast
    ?.filter((m: any) => m.poster_path)
    .sort((a: any, b: any) => (b.vote_count * b.vote_average) - (a.vote_count * a.vote_average))
    .slice(0, 20) || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text as string} />
        </TouchableOpacity>
        
        {profileUrl ? (
          <Image source={{ uri: profileUrl }} style={styles.profileImage} />
        ) : (
          <View style={[styles.profileImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: colors.icon }}>Sem Foto</Text>
          </View>
        )}
        
        <Text style={[styles.name, { color: colors.text }]}>{actor.name}</Text>
        {actor.place_of_birth && <Text style={[styles.birth, { color: colors.icon }]}>{actor.place_of_birth}</Text>}
      </View>

      <View style={styles.content}>
        {actor.biography ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Biografia</Text>
            <Text style={[styles.bio, { color: colors.text }]}>{actor.biography}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Conhecido(a) por</Text>
          
          <FlatList
            data={credits}
            keyExtractor={(item: any, index: number) => `${item.id}-${item.media_type}-${index}`}     
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
            renderItem={({ item }: { item: any }) => (
              <MovieCard 
                movie={item}
                onPress={() => router.push(`/${item.media_type}/${item.id}` as any)}
              />
            )}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  birth: {
    fontSize: 14,
    opacity: 0.8,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  bio: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.9,
  },
});
