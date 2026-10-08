import Logo from "@/components/Logo";
import { colors, radius, shadow, spacing } from "@/constants/designSystem";
import { Ionicons } from "@expo/vector-icons";
import * as Font from 'expo-font';
import { useRouter } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Mantiene la pantalla de bienvenida visible mientras cargan las fuentes
SplashScreen.preventAutoHideAsync();

export default function WelcomeScreen() {
  const router = useRouter();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
          'LiuJianMaoCao-Regular': require('./assets/fonts/LiuJianMaoCao-Regular.ttf'),
        });
      } catch (e) {
        console.warn("Error cargando fuentes: ", e);
      } finally {
        setFontsLoaded(true);
        SplashScreen.hideAsync();
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <View style={styles.topContent}>
        <Logo variant="light" size="lg" />
        <Text style={styles.welcome}>Bienvenido!</Text>
        <Text style={styles.description}>
          En Ta Fresco, somos tu plaza online, ¡permítenos ir a la plaza por ti!
        </Text>
      </View>

      <Image
        source={require("./assets/images/fruits.png")}
        style={styles.fruits}
      />

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.85}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Iniciar</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  blobTop: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primaryDark,
    opacity: 0.55,
  },
  blobBottom: {
    position: "absolute",
    bottom: 120,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accent,
    opacity: 0.18,
  },
  topContent: {
    alignItems: "center",
    paddingTop: 60,
  },
  welcome: {
    fontSize: 56,
    color: colors.white,
    fontFamily: "LiuJianMaoCao-Regular",
    marginTop: 28,
    marginBottom: 14,
  },
  description: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 17,
    textAlign: "center",
    maxWidth: "88%",
    lineHeight: 24,
    fontFamily: "Poppins-Regular",
  },
  fruits: {
    width: 280,
    height: 180,
    resizeMode: "contain",
    position: "absolute",
    bottom: 0,
    left: -20,
    opacity: 0.95,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: radius.pill,
    ...shadow.button,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "Poppins-Regular",
  },
});
