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
      <View style={styles.topContent}>
        <Image
          source={require("./assets/images/logo.png")}
          style={styles.logo}
        />
        <Text style={styles.welcome}>Bienvenido!</Text>
        <Text style={styles.description}>
          En Frescapp, somos tu plaza online, ¡permítenos ir a la plaza por ti!
        </Text>
      </View>

      <Image
        source={require("./assets/images/fruits.png")}
        style={styles.fruits}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Iniciar 🡺</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#212121",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  topContent: {
    alignItems: "center",
    paddingTop: 60,
  },
  logo: {
    width: 220,
    height: 120,
    resizeMode: "contain",
    marginBottom: 25,
  },
  welcome: {
    fontSize: 64,
    color: "#fff",
    fontFamily: "LiuJianMaoCao-Regular",
    marginBottom: 20,
  },
  description: {
    color: "#fff",
    fontSize: 20,
    textAlign: "center",
    maxWidth: "85%",
    lineHeight: 26,
    fontFamily: "Poppins-Regular",
    position: "relative",
    top: 21,
  },
  fruits: {
    width: 280,
    height: 180,
    resizeMode: "contain",
    position: "absolute",
    bottom: 0,
    left: -20,
  },
  button: {
    position: "absolute",
    bottom: 30,
    right: 30,
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Poppins-Regular",
    left: 20,
    position: "relative",
    top: 21,
  },
  chatbotButton: {
    position: "absolute",
    bottom: 30,
    left: 30,
    backgroundColor: "#83c41a",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
  },
  chatbotButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Poppins-Regular",
  },
});
