import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { colors as lightColors } from '@/constants/designSystem';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ta-fresco-theme-mode';

const darkColors = {
  ...lightColors,
  background: '#101713',
  surface: '#1B241F',
  ink: '#0B120E',
  textPrimary: '#F2F6F3',
  textSecondary: '#BEC9C1',
  textMuted: '#9AA79F',
  border: '#34423A',
  divider: '#2A372F',
  primaryLight: '#173D26',
  successLight: '#173D26',
  dangerLight: '#4A2221',
  warningLight: '#493A18',
  warningText: '#FBBF24',
  infoLight: '#1D3150',
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: typeof lightColors;
  ready: boolean;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: React.PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'light' || savedMode === 'dark') setModeState(savedMode);
      })
      .catch((error) => console.warn('No se pudo leer el tema guardado:', error))
      .finally(() => setReady(true));
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch((error) =>
      console.warn('No se pudo guardar el tema:', error)
    );
  };

  const value = useMemo(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, ready, setMode }),
    [mode, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme debe usarse dentro de AppThemeProvider');
  return context;
}
