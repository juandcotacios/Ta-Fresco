import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { auth } from '@/src/config/firebase';
import { CartProvider } from '@/src/contexts/CartContext';
import { AppThemeProvider, useAppTheme } from '@/src/contexts/ThemeContext';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <RootLayoutContent />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutContent() {
  const { mode, colors: themeColors, ready: themeReady } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [restoredSignedInSession, setRestoredSignedInSession] = useState(false);
  const firstAuthEvent = useRef(true);

  useEffect(() => {
    // Edge-to-edge Android exposes the native window behind resized screens
    // when the keyboard closes; keep that surface in sync with the app theme.
    setBackgroundColorAsync(themeColors.background).catch(() => undefined);
  }, [themeColors.background]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (firstAuthEvent.current) {
        firstAuthEvent.current = false;
        setRestoredSignedInSession(Boolean(currentUser));
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !segments[0]) return;

    const rootSegment = String(segments[0]);
    const publicSegments = new Set(['index', 'login', 'register']);

    if (
      user &&
      (rootSegment === 'index' ||
        (restoredSignedInSession && publicSegments.has(rootSegment)))
    ) {
      router.replace('/(tabs)/home');
      return;
    }

    if (!user && !publicSegments.has(rootSegment)) {
      router.replace('/login');
    }
  }, [authReady, restoredSignedInSession, router, segments, user]);

  return (
    <CartProvider>
      <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
        {authReady && themeReady ? (
          <Stack
            key={user?.uid ?? 'signed-out'}
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: themeColors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pedidos/index" />
            <Stack.Screen name="admin/index" />
            <Stack.Screen name="admin-pedidos/index" />
            <Stack.Screen name="admin-productos/index" />
            <Stack.Screen name="tienda/index" />
            <Stack.Screen name="tiendas/index" />
            <Stack.Screen name="convertirse-tendero/index" />
            <Stack.Screen name="chatbot/index" />
          </Stack>
        ) : (
          <View style={[styles.authLoading, { backgroundColor: themeColors.background }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        )}
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
