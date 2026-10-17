import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#00695C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#A7F3E4',
    onPrimaryContainer: '#00201B',
    secondaryContainer: '#CDE8E1',
    onSecondaryContainer: '#06201B',
    background: '#F7FAF8',
    surface: '#F7FAF8',
    elevation: { ...MD3LightTheme.colors.elevation, level2: '#EAF2EF' },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#7FD8C6',
    onPrimary: '#003730',
    primaryContainer: '#005046',
    onPrimaryContainer: '#A7F3E4',
    secondaryContainer: '#334B46',
    onSecondaryContainer: '#CDE8E1',
    background: '#0F1513',
    surface: '#0F1513',
    elevation: { ...MD3DarkTheme.colors.elevation, level2: '#1B2421' },
  },
};

/** Keeps navigation chrome (headers, tab bar, screen background) in step with the Paper theme. */
export function navigationTheme(paper: MD3Theme): Theme {
  const base = paper.dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.surface,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
    },
  };
}
