const tintColorDark = '#FF3B30'; // Cinematic Red
const backgroundColorDark = '#09090B'; // Very dark grey/black
const surfaceColorDark = '#18181B'; // Dark grey

export const Colors: Record<'light' | 'dark', any> = {
  dark: {
    text: '#ECEDEE',
    background: backgroundColorDark,
    surface: surfaceColorDark,
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    border: '#27272A',
    card: surfaceColorDark,
  },
  // Mesmo sendo app com tema dinâmico, vamos forçar cores modernas (Dark Mode principal)
  light: {
    text: '#11181C',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    tint: tintColorDark,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorDark,
    border: '#E4E4E7',
    card: '#FFFFFF',
  },
};
