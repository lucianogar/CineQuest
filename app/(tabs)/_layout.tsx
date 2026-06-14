import { Tabs } from 'expo-router';
import React from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Home, Search, CalendarDays, MapPin, UserSquare2, Library } from 'lucide-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[theme]; // Forçando usar esquema robusto

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Busca',
          tabBarIcon: ({ color }) => <Search size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Coleção',
          tabBarIcon: ({ color }) => <Library size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cinemas"
        options={{
          title: 'Cinemas',
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <UserSquare2 size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="movie/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tv/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="actor/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
