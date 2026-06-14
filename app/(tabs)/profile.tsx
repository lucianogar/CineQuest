import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, ScrollView, Modal, Share } from 'react-native';
import { useState, useEffect } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { Mail, Lock, LogIn, LogOut, User } from 'lucide-react-native';
import CustomModal from '@/components/CustomModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Funções Auxiliares para Serialização e Deserialização XML
function escapeXml(unsafe: string | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(safe: string): string {
  if (!safe) return '';
  return safe
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function exportToXML(movies: any[], episodes: any[], preferences: any[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<cinequest>\n';
  
  xml += '  <user_movies>\n';
  for (const m of movies) {
    xml += '    <item>\n';
    xml += `      <id>${escapeXml(m.id)}</id>\n`;
    xml += `      <user_id>${escapeXml(m.user_id)}</user_id>\n`;
    xml += `      <movie_id>${escapeXml(m.movie_id)}</movie_id>\n`;
    xml += `      <title>${escapeXml(m.title)}</title>\n`;
    xml += `      <poster_path>${escapeXml(m.poster_path)}</poster_path>\n`;
    xml += `      <release_date>${escapeXml(m.release_date)}</release_date>\n`;
    xml += `      <status>${escapeXml(m.status)}</status>\n`;
    xml += `      <location>${escapeXml(m.location)}</location>\n`;
    xml += `      <media_type>${escapeXml(m.media_type)}</media_type>\n`;
    xml += `      <viewing_date>${escapeXml(m.viewing_date)}</viewing_date>\n`;
    xml += `      <added_at>${escapeXml(m.added_at)}</added_at>\n`;
    xml += `      <genre_ids>${escapeXml(JSON.stringify(m.genre_ids || []))}</genre_ids>\n`;
    xml += `      <vote_average>${escapeXml(m.vote_average)}</vote_average>\n`;
    xml += `      <runtime>${escapeXml(m.runtime)}</runtime>\n`;
    xml += '    </item>\n';
  }
  xml += '  </user_movies>\n';

  xml += '  <user_episodes>\n';
  for (const ep of episodes) {
    xml += '    <item>\n';
    xml += `      <id>${escapeXml(ep.id)}</id>\n`;
    xml += `      <user_id>${escapeXml(ep.user_id)}</user_id>\n`;
    xml += `      <series_id>${escapeXml(ep.series_id)}</series_id>\n`;
    xml += `      <season_number>${escapeXml(ep.season_number)}</season_number>\n`;
    xml += `      <episode_number>${escapeXml(ep.episode_number)}</episode_number>\n`;
    xml += `      <added_at>${escapeXml(ep.added_at || ep.watched_at)}</added_at>\n`;
    xml += '    </item>\n';
  }
  xml += '  </user_episodes>\n';

  xml += '  <user_preferences>\n';
  for (const pref of preferences) {
    xml += '    <item>\n';
    xml += `      <id>${escapeXml(pref.id)}</id>\n`;
    xml += `      <user_id>${escapeXml(pref.user_id)}</user_id>\n`;
    xml += `      <alert_1d>${escapeXml(pref.alert_1d)}</alert_1d>\n`;
    xml += `      <alert_3h>${escapeXml(pref.alert_3h)}</alert_3h>\n`;
    xml += `      <alert_2h>${escapeXml(pref.alert_2h)}</alert_2h>\n`;
    xml += `      <alert_1h>${escapeXml(pref.alert_1h)}</alert_1h>\n`;
    xml += `      <alert_30m>${escapeXml(pref.alert_30m)}</alert_30m>\n`;
    xml += `      <lert_7d>${escapeXml(pref.lert_7d)}</lert_7d>\n`;
    xml += '    </item>\n';
  }
  xml += '  </user_preferences>\n';

  xml += '</cinequest>\n';
  return xml;
}

function parseXML(xmlText: string) {
  const parseTagContent = (xml: string, tagName: string): string[] => {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'g');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  };

  const parseItemFields = (itemXml: string): any => {
    const fieldsRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
    const item: any = {};
    let match;
    while ((match = fieldsRegex.exec(itemXml)) !== null) {
      const field = match[1];
      const val = unescapeXml(match[2].trim());
      
      if (val === 'true') {
        item[field] = true;
      } else if (val === 'false') {
        item[field] = false;
      } else if (val === 'null' || val === '') {
        item[field] = null;
      } else if (!isNaN(Number(val)) && field !== 'id' && field !== 'user_id' && !field.endsWith('_date') && field !== 'added_at') {
        item[field] = Number(val);
      } else if (field === 'genre_ids') {
        try {
          item[field] = JSON.parse(val);
        } catch {
          item[field] = [];
        }
      } else {
        item[field] = val;
      }
    }
    return item;
  };

  const userMoviesXml = parseTagContent(xmlText, 'user_movies')[0] || '';
  const userEpisodesXml = parseTagContent(xmlText, 'user_episodes')[0] || '';
  const userPrefsXml = parseTagContent(xmlText, 'user_preferences')[0] || '';

  const movies = parseTagContent(userMoviesXml, 'item').map(parseItemFields);
  const episodes = parseTagContent(userEpisodesXml, 'item').map(parseItemFields);
  const preferences = parseTagContent(userPrefsXml, 'item').map(parseItemFields);

  return { movies, episodes, preferences };
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme];
  const { session } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [preferences, setPreferences] = useState<any>({
    alert_1d: false,
    alert_3h: false,
    alert_2h: true,
    alert_1h: false,
    alert_30m: false,
    lert_7d: false,
  });

  // Estados do Modal Importação XML
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [xmlInput, setXmlInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Estados do Modal de Alertas
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
      buttons: buttons || [{ text: 'Entendi', onPress: () => {}, primary: true }],
    });
  };

  const loadPreferences = async () => {
    if (!session) return;
    setPrefLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await supabase
          .from('user_preferences')
          .upsert({ user_id: session.user.id })
          .select()
          .single();
        if (!insertError) setPreferences(newData);
      } else if (!error && data) {
        setPreferences(data);
      }
    } catch (err) {
      console.error('Erro ao carregar preferências', err);
    } finally {
      setPrefLoading(false);
    }
  };

  const togglePreference = async (key: string) => {
    if (!session) return;
    const newValue = !preferences[key];
    const updatedPrefs = { ...preferences, [key]: newValue };
    setPreferences(updatedPrefs);

    const { error } = await supabase
      .from('user_preferences')
      .update({ [key]: newValue })
      .eq('user_id', session.user.id);
    
    if (error) {
      showModal('Erro', 'Não foi possível salvar sua preferência.', 'error');
      setPreferences(preferences);
    }
  };

  useEffect(() => {
    if (session) {
      loadPreferences();
    }
  }, [session]);

  async function handleAuth() {
    if (!email || !password) {
      showModal('Atenção', 'Por favor, preencha o e-mail e a senha para prosseguir.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showModal('Erro no Login', error.message, 'error');
      }
    } catch (err) {
      showModal('Erro Inesperado', 'Ocorreu uma falha na conexão. Tente novamente em instantes.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    showModal('Sair da Conta', 'Deseja realmente encerrar sua sessão no CineQuest?', 'warning', [
      { text: 'Sair', onPress: () => supabase.auth.signOut(), destructive: true },
      { text: 'Cancelar', onPress: () => {}, primary: false }
    ]);
  }

  const handleExportXML = async () => {
    setLoading(true);
    try {
      const localMoviesKey = '@local_table_user_movies';
      const localEpisodesKey = '@local_table_user_episodes';
      const localPrefsKey = '@local_table_user_preferences';

      const [moviesJson, epsJson, prefsJson] = await Promise.all([
        AsyncStorage.getItem(localMoviesKey),
        AsyncStorage.getItem(localEpisodesKey),
        AsyncStorage.getItem(localPrefsKey),
      ]);

      const movies = moviesJson ? JSON.parse(moviesJson) : [];
      const episodes = epsJson ? JSON.parse(epsJson) : [];
      const preferences = prefsJson ? JSON.parse(prefsJson) : [];

      const xml = exportToXML(movies, episodes, preferences);

      await Share.share({
        title: 'CineQuest Backup',
        message: xml,
      });
    } catch (e: any) {
      showModal('Erro', 'Não foi possível exportar os dados: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportXML = async () => {
    if (!xmlInput.trim()) return;
    setImporting(true);
    try {
      const parsed = parseXML(xmlInput);

      if (session) {
        // Online: importar para Supabase (Migração)
        for (const m of parsed.movies) {
          if (m.status === 'wishlist' || m.status === 'watching') {
            await supabase.from('user_movies')
              .delete()
              .eq('user_id', session.user.id)
              .eq('movie_id', Number(m.movie_id))
              .eq('status', m.status);
          }
          
          await supabase.from('user_movies').insert({
            user_id: session.user.id,
            movie_id: Number(m.movie_id),
            title: m.title,
            poster_path: m.poster_path || null,
            release_date: m.release_date || null,
            status: m.status || null,
            location: m.location || null,
            viewing_date: m.viewing_date || null,
            media_type: m.media_type || null,
            vote_average: m.vote_average ? Number(m.vote_average) : null,
            runtime: m.runtime ? Number(m.runtime) : null,
            genre_ids: Array.isArray(m.genre_ids) ? m.genre_ids : [],
            added_at: m.added_at || new Date().toISOString()
          });
        }

        const episodesPayload = parsed.episodes.map(ep => ({
          user_id: session.user.id,
          series_id: Number(ep.series_id),
          season_number: Number(ep.season_number),
          episode_number: Number(ep.episode_number),
          watched_at: ep.added_at || new Date().toISOString()
        }));
        
        if (episodesPayload.length > 0) {
          for (let i = 0; i < episodesPayload.length; i += 100) {
            const chunk = episodesPayload.slice(i, i + 100);
            await supabase.from('user_episodes').upsert(chunk, {
              onConflict: 'user_id,series_id,season_number,episode_number'
            });
          }
        }

        if (parsed.preferences && parsed.preferences.length > 0) {
          const pref = parsed.preferences[0];
          await supabase.from('user_preferences').upsert({
            user_id: session.user.id,
            alert_1d: pref.alert_1d !== undefined ? pref.alert_1d : false,
            alert_3h: pref.alert_3h !== undefined ? pref.alert_3h : false,
            alert_2h: pref.alert_2h !== undefined ? pref.alert_2h : true,
            alert_1h: pref.alert_1h !== undefined ? pref.alert_1h : false,
            alert_30m: pref.alert_30m !== undefined ? pref.alert_30m : false,
            lert_7d: pref.lert_7d !== undefined ? pref.lert_7d : false,
          }, { onConflict: 'user_id' });
          
          await loadPreferences();
        }
      } else {
        // Offline: importar para AsyncStorage
        const localMoviesKey = '@local_table_user_movies';
        const localEpisodesKey = '@local_table_user_episodes';
        const localPrefsKey = '@local_table_user_preferences';

        const existingMoviesJson = await AsyncStorage.getItem(localMoviesKey);
        let localMovies = existingMoviesJson ? JSON.parse(existingMoviesJson) : [];

        for (const m of parsed.movies) {
          if (m.status === 'wishlist' || m.status === 'watching') {
            localMovies = localMovies.filter((x: any) => !(String(x.movie_id) === String(m.movie_id) && x.status === m.status));
          }
          localMovies.push({
            id: m.id || Math.random().toString(36).substring(2, 9),
            movie_id: Number(m.movie_id),
            title: m.title,
            poster_path: m.poster_path || null,
            release_date: m.release_date || null,
            status: m.status || null,
            location: m.location || null,
            viewing_date: m.viewing_date || null,
            media_type: m.media_type || null,
            vote_average: m.vote_average ? Number(m.vote_average) : null,
            runtime: m.runtime ? Number(m.runtime) : null,
            genre_ids: Array.isArray(m.genre_ids) ? m.genre_ids : [],
            added_at: m.added_at || new Date().toISOString()
          });
        }
        await AsyncStorage.setItem(localMoviesKey, JSON.stringify(localMovies));

        const existingEpsJson = await AsyncStorage.getItem(localEpisodesKey);
        let localEps = existingEpsJson ? JSON.parse(existingEpsJson) : [];
        
        for (const ep of parsed.episodes) {
          localEps = localEps.filter((x: any) => !(
            String(x.series_id) === String(ep.series_id) &&
            String(x.season_number) === String(ep.season_number) &&
            String(x.episode_number) === String(ep.episode_number)
          ));
          localEps.push({
            id: ep.id || Math.random().toString(36).substring(2, 9),
            series_id: Number(ep.series_id),
            season_number: Number(ep.season_number),
            episode_number: Number(ep.episode_number),
            added_at: ep.added_at || new Date().toISOString()
          });
        }
        await AsyncStorage.setItem(localEpisodesKey, JSON.stringify(localEps));

        if (parsed.preferences && parsed.preferences.length > 0) {
          const pref = parsed.preferences[0];
          const localPref = {
            id: pref.id || Math.random().toString(36).substring(2, 9),
            alert_1d: pref.alert_1d !== undefined ? pref.alert_1d : false,
            alert_3h: pref.alert_3h !== undefined ? pref.alert_3h : false,
            alert_2h: pref.alert_2h !== undefined ? pref.alert_2h : true,
            alert_1h: pref.alert_1h !== undefined ? pref.alert_1h : false,
            alert_30m: pref.alert_30m !== undefined ? pref.alert_30m : false,
            lert_7d: pref.lert_7d !== undefined ? pref.lert_7d : false,
          };
          await AsyncStorage.setItem(localPrefsKey, JSON.stringify([localPref]));
          setPreferences(localPref);
        }
      }

      setImportModalVisible(false);
      showModal('Importação Concluída', 'Seus dados foram importados com sucesso!', 'success');
    } catch (e: any) {
      showModal('Erro na Importação', 'Ocorreu um erro ao processar o XML: ' + e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {session ? (
        <View style={styles.profileContent}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <User size={40} color={colors.tint} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Meu Perfil</Text>
            <Text style={[styles.userEmail, { color: colors.icon }]}>{session.user.email}</Text>
          </View>

          <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
            <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>Alertas de Cinema 🔔</Text>
               <Text style={[styles.sectionDesc, { color: colors.icon }]}>Escolha quando quer ser lembrado dos seus filmes salvos na agenda.</Text>
               
               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>7 dias antes</Text>
                  <Switch 
                    value={preferences.lert_7d} 
                    onValueChange={() => togglePreference('lert_7d')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.lert_7d ? colors.tint : '#f4f3f4'}
                  />
               </View>

               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>1 dia antes</Text>
                  <Switch 
                    value={preferences.alert_1d} 
                    onValueChange={() => togglePreference('alert_1d')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.alert_1d ? colors.tint : '#f4f3f4'}
                  />
               </View>

               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>3 horas antes</Text>
                  <Switch 
                    value={preferences.alert_3h} 
                    onValueChange={() => togglePreference('alert_3h')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.alert_3h ? colors.tint : '#f4f3f4'}
                  />
               </View>

               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>2 horas antes (Padrão)</Text>
                  <Switch 
                    value={preferences.alert_2h} 
                    onValueChange={() => togglePreference('alert_2h')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.alert_2h ? colors.tint : '#f4f3f4'}
                  />
               </View>

               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>1 hora antes</Text>
                  <Switch 
                    value={preferences.alert_1h} 
                    onValueChange={() => togglePreference('alert_1h')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.alert_1h ? colors.tint : '#f4f3f4'}
                  />
               </View>

               <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>30 minutos antes</Text>
                  <Switch 
                    value={preferences.alert_30m} 
                    onValueChange={() => togglePreference('alert_30m')}
                    trackColor={{ false: colors.border, true: colors.tint + '80' }}
                    thumbColor={preferences.alert_30m ? colors.tint : '#f4f3f4'}
                  />
               </View>
            </View>

            {/* XML Import/Export para Logado */}
            <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 20 }]}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>Migração e Backup 💾</Text>
               <Text style={[styles.sectionDesc, { color: colors.icon }]}>
                 Exporte seus dados em XML ou importe/migre dados de outro dispositivo diretamente para a nuvem.
               </Text>
               
               <View style={{ flexDirection: 'row', gap: 10 }}>
                 <TouchableOpacity 
                   style={[styles.actionButton, { backgroundColor: colors.tint }]} 
                   onPress={handleExportXML}
                 >
                   <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Exportar XML</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                   onPress={() => { setXmlInput(''); setImportModalVisible(true); }}
                 >
                   <Text style={{ color: colors.text, fontWeight: 'bold' }}>Importar XML</Text>
                 </TouchableOpacity>
               </View>
            </View>

            <TouchableOpacity 
              style={[styles.signOutButton, { borderColor: colors.border, marginTop: 25 }]} 
              onPress={handleSignOut}
            >
              <LogOut size={20} color={colors.tint} />
              <Text style={[styles.signOutText, { color: colors.tint }]}>Sair da Conta</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={styles.authContent}>
            <View style={styles.authHeader}>
              <View style={[styles.logoCircle, { backgroundColor: colors.tint }]}>
                <LogIn size={32} color="#FFF" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>CineQuest</Text>
              <Text style={[styles.subtitle, { color: colors.icon }]}>Seu controle de cinema pessoal</Text>
            </View>

            <View style={styles.form}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Mail size={18} color={colors.icon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="E-mail"
                  placeholderTextColor={colors.icon}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Lock size={18} color={colors.icon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Senha"
                  placeholderTextColor={colors.icon}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity 
                style={[styles.mainButton, { backgroundColor: colors.tint }]} 
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <LogIn size={20} color="#FFF" />
                    <Text style={styles.mainButtonText}>Entrar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* XML Import/Export para Deslogado */}
            <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 30 }]}>
               <Text style={[styles.sectionTitle, { color: colors.text }]}>Backup Local 💾</Text>
               <Text style={[styles.sectionDesc, { color: colors.icon }]}>
                 Mesmo offline, você pode exportar seus dados locais em XML para backup ou importar um arquivo anterior.
               </Text>
               
               <View style={{ flexDirection: 'row', gap: 10 }}>
                 <TouchableOpacity 
                   style={[styles.actionButton, { backgroundColor: colors.tint }]} 
                   onPress={handleExportXML}
                 >
                   <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Exportar XML</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                   onPress={() => { setXmlInput(''); setImportModalVisible(true); }}
                 >
                   <Text style={{ color: colors.text, fontWeight: 'bold' }}>Importar XML</Text>
                 </TouchableOpacity>
               </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Modal para Colar XML */}
      <Modal
        visible={importModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Importar Dados XML</Text>
            <Text style={[styles.modalDesc, { color: colors.icon }]}>
              Cole o conteúdo XML do seu backup abaixo. Os dados serão {session ? 'importados e migrados para a sua conta online' : 'salvos localmente no dispositivo'}.
            </Text>
            <TextInput
              style={[styles.xmlTextArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              multiline={true}
              numberOfLines={10}
              placeholder="Cole seu XML aqui..."
              placeholderTextColor={colors.icon}
              value={xmlInput}
              onChangeText={setXmlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} 
                onPress={() => setImportModalVisible(false)}
                disabled={importing}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.tint }]} 
                onPress={handleImportXML}
                disabled={importing || !xmlInput.trim()}
              >
                {importing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        buttons={modalConfig.buttons}
        onClose={() => setModalConfig({ ...modalConfig, visible: false })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 25, paddingTop: Platform.OS === 'ios' ? 40 : 20 },
  profileContent: { flex: 1 },
  authContent: { flex: 1, justifyContent: 'center', paddingVertical: 20 },
  authHeader: { alignItems: 'center', marginBottom: 35 },
  logoCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 5 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  form: { gap: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, height: 56, gap: 12 },
  input: { flex: 1, fontSize: 16 },
  mainButton: { flexDirection: 'row', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  mainButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  profileHeader: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  userEmail: { fontSize: 16 },
  menuContainer: { flex: 1 },
  signOutButton: { flexDirection: 'row', height: 56, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 20 },
  signOutText: { fontSize: 16, fontWeight: 'bold' },
  settingsSection: { padding: 20, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 5 },
  sectionDesc: { fontSize: 12, marginBottom: 20, lineHeight: 18, opacity: 0.8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  
  // Novos estilos de Botão de Ação XML e Modais
  actionButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, gap: 16, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 12 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  modalDesc: { fontSize: 14, opacity: 0.7, lineHeight: 20 },
  xmlTextArea: { height: 180, borderRadius: 14, borderWidth: 1, padding: 14, textAlignVertical: 'top', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 5 },
  modalButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
});
