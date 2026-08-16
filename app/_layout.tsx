import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { app } from '@/src/config/firebase';
import { CartProvider } from '@/src/contexts/CartContext';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<any>(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  return (
    <CartProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {user ? (
            
            <Stack.Screen name="(tabs)" />
          ) : (
            [
              <Stack.Screen key="index" name="index" />,
              <Stack.Screen key="login" name="login" />,
              <Stack.Screen key="register" name="register" />,
            ]
          )}

          {}
          <Stack.Screen name="checkout/index" />
          <Stack.Screen name="pedidos/index" />
          <Stack.Screen name="chatbot/index" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </CartProvider>
  );
}
