import { Linking } from 'react-native';

/**
 * Tenta abrir o filme ou série diretamente no aplicativo do provedor de streaming.
 * Se o aplicativo correspondente estiver instalado, a URL será interceptada e abrirá o app.
 * Caso contrário, abrirá a página de busca no navegador web ou o link fornecido.
 * 
 * @param providerName Nome do provedor (ex: "Netflix", "Amazon Prime Video", etc.)
 * @param title Nome do filme ou série
 * @param fallbackUrl URL de fallback (geralmente o link do watch/providers do TMDB)
 */
export const openWatchProvider = async (providerName: string, title: string, fallbackUrl?: string) => {
  const query = encodeURIComponent(title);
  let url = '';

  const name = providerName.toLowerCase();

  if (name.includes('netflix')) {
    // URL especial do Netflix que aciona o app diretamente
    url = `nflx://www.netflix.com/search?q=${query}`;
  } else if (name.includes('prime video') || name.includes('amazon')) {
    // Prime Video intercepta links de busca
    url = `https://www.primevideo.com/search/?phrase=${query}`;
  } else if (name.includes('disney')) {
    // Disney+ intercepta links de busca
    url = `https://www.disneyplus.com/search?q=${query}`;
  } else if (name.includes('max') || name.includes('hbo')) {
    // Max intercepta links de busca
    url = `https://play.max.com/search?q=${query}`;
  } else if (name.includes('apple tv')) {
    // Apple TV+
    url = `https://tv.apple.com/search?term=${query}`;
  } else if (name.includes('globoplay')) {
    // Globoplay
    url = `https://globoplay.globo.com/busca/?q=${query}`;
  } else if (name.includes('star+')) {
    // Star+
    url = `https://www.starplus.com/search?q=${query}`;
  } else if (name.includes('paramount')) {
    // Paramount+
    url = `https://www.paramountplus.com/search/?q=${query}`;
  } else if (name.includes('crunchyroll')) {
    // Crunchyroll
    url = `https://www.crunchyroll.com/search?q=${query}`;
  } else if (name.includes('youtube')) {
    // YouTube
    url = `https://www.youtube.com/results?search_query=${query}`;
  } else if (name.includes('google play')) {
    // Google Play Filmes
    url = `https://play.google.com/store/search?q=${query}&c=movies`;
  }

  // Tenta abrir a URL do aplicativo ou o fallback
  try {
    if (url) {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
      // Se canOpen retornar falso mas for uma URL https válida (como a do Prime Video, Disney+, Max),
      // o próprio sistema operacional pode tratar via Universal Links ou abrir no navegador
      if (url.startsWith('http')) {
        await Linking.openURL(url);
        return;
      }
    }
  } catch (e) {
    console.warn('Erro ao abrir link dedicado do provedor, usando fallback...', e);
  }

  // Se falhar ou não tiver URL dedicada, usa a URL do TMDB (que lista as opções) ou busca no Google
  const finalFallback = fallbackUrl || `https://www.google.com/search?q=assistir+${query}+no+${encodeURIComponent(providerName)}`;
  try {
    await Linking.openURL(finalFallback);
  } catch (e) {
    console.error('Erro ao abrir link de fallback:', e);
  }
};
