import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';


/**
 * Helper para carregar o módulo de notificações de forma segura
 */
const getNotificationsModule = () => {
  // No SDK 53+, o simples carregamento (require) do módulo no Expo Go Android causa crash
  // pois o pacote tenta registrar tokens de push remotas que foram removidas do Expo Go.
  const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';
  
  if (isExpoGoAndroid) {
    // Retornamos null silenciosamente para não quebrar a execução do restante do app
    return null;
  }

  try {
    const Notifications = require('expo-notifications');
    return Notifications;
  } catch (err) {
    console.warn('Módulo expo-notifications não encontrado ou falhou ao carregar');
    return null;
  }
};

// Tenta configurar o handler de forma segura na inicialização se possível
try {
  const Notifications = getNotificationsModule();
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('Falha ao configurar NotificationHandler (Comum no Expo Go SDK 53+)');
}

export async function requestNotificationPermissions() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('movie-alerts', {
          name: 'Alertas de Filmes',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (e) {
        console.warn('Erro ao criar canal de notificações:', e);
      }
    }

    return true;
  } catch (err) {
    console.error('Erro ao gerenciar permissões de notificações:', err);
    return false;
  }
}

export async function scheduleMovieAlerts(movieId: number, title: string, viewingDate: Date, userId: string) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  // 1. Cancelamos qualquer alerta existente
  await cancelMovieAlerts(movieId);

  // 2. Buscar preferências (com fallback para padrão se não existir no banco)
  const { data: dbPrefs } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  const prefs = dbPrefs || {
    alert_1d: false,
    alert_3h: false,
    alert_2h: true, // Padrão 2h ativado
    alert_1h: false,
    alert_30m: false,
    lert_7d: false,
  };

  const now = new Date();
  const alerts = [
    { id: '7d', key: 'lert_7d', label: 'em uma semana', offset: 7 * 24 * 60 * 60 * 1000 },
    { id: '1d', key: 'alert_1d', label: 'amanhã', offset: 24 * 60 * 60 * 1000 },
    { id: '3h', key: 'alert_3h', label: 'em 3 horas', offset: 3 * 60 * 60 * 1000 },
    { id: '2h', key: 'alert_2h', label: 'em 2 horas', offset: 2 * 60 * 60 * 1000 },
    { id: '1h', key: 'alert_1h', label: 'em 1 hora', offset: 1 * 60 * 60 * 1000 },
    { id: '30m', key: 'alert_30m', label: 'em 30 minutos', offset: 30 * 60 * 1000 },
  ];

  let scheduledCount = 0;

  for (const alert of alerts) {
    if (!prefs[alert.key]) continue;
    
    // triggerDate = viewingDate - offset (ex: filme as 20h, alerta 2h antes -> 18h)
    const triggerDate = new Date(viewingDate.getTime() - alert.offset);
    
    if (triggerDate > now) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `movie_${movieId}_${alert.id}`,
          content: {
            title: 'Lembrete CineQuest 🎬',
            body: `Você planejou assistir "${title}" ${alert.label}!`,
            data: { movieId },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate 
          } as any,
        });
        scheduledCount++;
      } catch (err) {
        console.error(`❌ Erro ao agendar alerta ${alert.id}:`, err);
      }
    }
  }

  if (scheduledCount > 0) {
    console.log(`✅ [Notifications] ${scheduledCount} alertas agendados para "${title}".`);
  } else {
    console.log(`ℹ️ [Notifications] Nenhum alerta agendado para "${title}" (todas as datas no passado).`);
  }
}

/**
 * Cancela todos os alertas de um filme
 */
export async function cancelMovieAlerts(movieId: number) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  const ids = ['7d', '1d', '3h', '2h', '1h', '30m'];
  for (const suffix of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`movie_${movieId}_${suffix}`);
    } catch (e) {}
  }
}
