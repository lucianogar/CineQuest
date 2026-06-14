import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking, TextInput, ScrollView, Animated, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { MapPin, Navigation, Film, Clock, Search, RotateCcw } from 'lucide-react-native';
import axios from 'axios';
import CustomModal from '@/components/CustomModal';

interface Cinema {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distance?: string;
  address?: string;
}

const RADIUS_OPTIONS = [15, 30, 50, 100, 150];
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

export default function CinemasScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Estados de Busca
  const [cityInput, setCityInput] = useState('');
  const [radius, setRadius] = useState(15);

  // Estados do Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({ title: '', message: '', buttons: [] });

  const loadCinemas = async (forcedCity?: string, forcedRadius?: number) => {
    setLoading(true);
    setErrorMsg(null);
    const searchRadius = forcedRadius || radius;
    const searchCity = forcedCity || cityInput;

    try {
      let lat: number;
      let lon: number;

      if (searchCity.trim().length > 1) {
        const geocoded = await Location.geocodeAsync(searchCity);
        if (geocoded.length === 0) throw new Error('Cidade não encontrada.');
        lat = geocoded[0].latitude;
        lon = geocoded[0].longitude;
      } else {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('GPS Desativado. Digite uma cidade acima.');
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = location.coords.latitude;
        lon = location.coords.longitude;
      }

      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="cinema"](around:${searchRadius * 1000}, ${lat}, ${lon});
          way["amenity"="cinema"](around:${searchRadius * 1000}, ${lat}, ${lon});
        );
        out center;
      `;

      let response;
      let lastError;

      // Tentar múltiplos endpoints se um falhar (Resiliência contra 504)
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          response = await axios.post(endpoint, query, {
            headers: { 'Content-Type': 'text/plain' },
            timeout: 25000 // Aumentado para 25 segundos
          });
          if (response.data) break;
        } catch (e) {
          lastError = e;
          console.log(`Endpoint ${endpoint} falhou, tentando o próximo...`);
          continue;
        }
      }

      if (!response && lastError) throw lastError;

      if (response && response.data && response.data.elements) {
        const list: Cinema[] = response.data.elements.map((el: any) => {
          const elLat = el.lat || el.center?.lat;
          const elLon = el.lon || el.center?.lon;
          const name = el.tags?.name || 'Cinema Desconhecido';
          return {
            id: el.id,
            name,
            lat: elLat,
            lon: elLon,
            distance: calculateDistance(lat, lon, elLat, elLon),
            address: el.tags?.["addr:street"] ? `${el.tags["addr:street"]}, ${el.tags["addr:housenumber"] || ''}` : undefined
          };
        }).filter((c: Cinema) => c.name !== 'Cinema Desconhecido')
          .sort((a: Cinema, b: Cinema) => parseFloat(a.distance!) - parseFloat(b.distance!));

        setCinemas(list);
        if (list.length === 0) setErrorMsg(`Nenhum cinema em ${searchRadius}km.`);
      }
    } catch (err: any) {
      console.error('Final Search Error:', err);
      const isTimeout = err.code === 'ECONNABORTED' || (err.response && err.response.status === 504);
      
      setModalConfig({
        type: 'error',
        title: isTimeout ? 'Servidor Sobrecarregado' : 'Busca de Cinemas',
        message: isTimeout 
          ? 'Os servidores de mapas estão lentos agora devido ao alto tráfego. Gostaria de tentar novamente?' 
          : err.message || 'Falha na conexão com o serviço de mapas.',
        buttons: [{ text: 'Tentar Novamente', onPress: () => { setModalVisible(false); loadCinemas(); }, primary: true }]
      });
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCinemas();
  }, []);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return (R * c).toFixed(1);
  }

  const openRoute = (cinema: Cinema) => {
    const url = Platform.OS === 'ios' 
      ? `maps://0,0?q=${cinema.lat},${cinema.lon}` 
      : `geo:0,0?q=${cinema.lat},${cinema.lon}(${cinema.name})`;
    Linking.openURL(url).catch(() => {
      const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${cinema.lat},${cinema.lon}`;
      Linking.openURL(gMapsUrl);
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Cinemas</Text>
        
        <View style={[styles.searchRow, { borderColor: colors.border }]}>
          <Search size={18} color={colors.icon} />
          <TextInput
            style={[styles.cityInput, { color: colors.text }]}
            placeholder="Digite sua cidade (ex: São José)"
            placeholderTextColor={colors.icon}
            value={cityInput}
            onChangeText={setCityInput}
            onSubmitEditing={() => loadCinemas()}
            returnKeyType="search"
          />
          {loading ? (
             <ActivityIndicator size="small" color={colors.tint} />
          ) : (
            <TouchableOpacity onPress={() => loadCinemas()} style={styles.goBtn}>
              <RotateCcw size={18} color={colors.tint} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.radiusContainer}>
           <Text style={[styles.radiusLabel, { color: colors.icon }]}>Raio de busca:</Text>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusScroll}>
              {RADIUS_OPTIONS.map(opt => (
                <TouchableOpacity 
                  key={opt} 
                  onPress={() => { setRadius(opt); loadCinemas(cityInput, opt); }}
                  style={[
                    styles.radiusChip, 
                    { backgroundColor: radius === opt ? colors.tint : colors.background, borderColor: colors.border }
                  ]}
                >
                  <Text style={[styles.radiusChipText, { color: radius === opt ? '#FFF' : colors.text }]}>
                    {opt}km
                  </Text>
                </TouchableOpacity>
              ))}
           </ScrollView>
        </View>
      </View>

      {cinemas.length === 0 && !loading ? (
        <View style={styles.centerContainer}>
          <Film size={60} color={colors.border} opacity={0.3} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum cinema encontrado</Text>
          <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
            {cityInput ? `Não encontramos cinemas em ${cityInput}.` : 'Tente aumentar o raio ou digitar sua cidade.'}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.tint }]} onPress={() => { setCityInput(''); loadCinemas('', 15); }}>
            <Text style={styles.retryBtnText}>Restaurar GPS</Text>
          </TouchableOpacity>
        </View>
      ) : loading && cinemas.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.icon }]}>Mapeando cinemas na região...</Text>
        </View>
      ) : (
        <FlatList
          data={cinemas}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={() => loadCinemas()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.cinemaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => openRoute(item)}
            >
              <View style={styles.cinemaInfo}>
                <Text style={[styles.cinemaName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                {item.address && (
                  <Text style={[styles.cinemaAddress, { color: colors.icon }]} numberOfLines={1}>{item.address}</Text>
                )}
                
                <View style={[styles.statusRow]}>
                   <View style={[styles.distanceBadge, { backgroundColor: colors.background }]}>
                    <MapPin size={10} color={colors.tint} />
                    <Text style={[styles.distanceText, { color: colors.text }]}>{item.distance} km</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.sessionLink]} 
                    onPress={() => Linking.openURL(`https://www.google.com/search?q=horarios+cinema+${encodeURIComponent(item.name)}`)}
                  >
                    <Clock size={12} color={colors.tint} />
                    <Text style={[styles.sessionLinkText, { color: colors.tint }]}>Sessões</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.routeBtnCircle, { backgroundColor: colors.tint }]}>
                 <Navigation size={18} color="#FFF" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  header: { padding: 20, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 10 },
  headerTitle: { fontSize: 26, fontWeight: '900', marginBottom: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 15, borderWidth: 1, paddingHorizontal: 15, marginBottom: 15, gap: 10 },
  cityInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  goBtn: { padding: 5 },
  radiusContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radiusLabel: { fontSize: 12, fontWeight: 'bold' },
  radiusScroll: { gap: 8, paddingRight: 20 },
  radiusChip: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  radiusChipText: { fontSize: 11, fontWeight: '900' },
  loadingText: { marginTop: 15, fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 5 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', opacity: 0.7, marginBottom: 25 },
  retryBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontWeight: 'bold' },
  listContent: { paddingHorizontal: 15, paddingBottom: 40 },
  cinemaCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12, elevation: 1 },
  cinemaInfo: { flex: 1 },
  cinemaName: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  cinemaAddress: { fontSize: 12, marginBottom: 10, opacity: 0.8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  distanceText: { fontSize: 10, fontWeight: '900' },
  sessionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionLinkText: { fontSize: 11, fontWeight: 'bold', textDecorationLine: 'underline' },
  routeBtnCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
});
