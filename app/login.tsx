import { useRouter } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

import GoogleLoginModal from "@/components/GoogleLoginModal";

import { auth, db } from "@/src/config/firebase";
import { GOOGLE_AUTH } from "@/src/config/googleAuth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'loading' | 'success'>('loading');

  // Flujo nativo de Google: abre el selector de cuenta del sistema
  // (o el navegador) y devuelve un id_token que le pasamos a Firebase.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_AUTH.webClientId,
    androidClientId: GOOGLE_AUTH.androidClientId,
    iosClientId: GOOGLE_AUTH.iosClientId,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      finishGoogleSignIn(id_token);
    } else if (response?.type === "error") {
      setModalVisible(false);
      Alert.alert("Error", "No se pudo iniciar sesión con Google.");
    }
    // Si el usuario cierra el selector de cuenta (type === "cancel"),
    // no mostramos error, simplemente cerramos el modal.
    else if (response?.type === "cancel" || response?.type === "dismiss") {
      setModalVisible(false);
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Campos vacíos", "Por favor, ingresa tu correo y contraseña.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Error al iniciar sesión", error.message);
    }
  };

  // Crea el perfil en Firestore si es la primera vez, y navega a home.
  // Se usa tanto para el flujo nativo (id_token) como para el de web (popup).
  const afterGoogleSignIn = async (user: User) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        nickname: user.displayName || "Usuario Google",
        email: user.email,
        photoURL: user.photoURL || "",
        phone: "",
        createdAt: new Date(),
      });
      console.log("Perfil de Google creado en Firestore");
    }

    setLoginStatus("success");

    setTimeout(() => {
      setModalVisible(false);
      router.push("/(tabs)/home");
    }, 1500);
  };

  const finishGoogleSignIn = async (idToken: string) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await afterGoogleSignIn(result.user);
    } catch (error: any) {
      setModalVisible(false);
      Alert.alert("Error", "Fallo al iniciar con Google: " + error.message);
    }
  };

  const handleGoogle = async () => {
    // En web, expo-auth-session abre un popup y detecta que se cerró
    // sondeando `window.closed`, pero el dev server de Expo manda una
    // cabecera Cross-Origin-Opener-Policy que bloquea justo eso, así
    // que el login se queda colgado para siempre. En web usamos el
    // popup nativo de Firebase, que no depende de `window.closed`.
    if (Platform.OS === "web") {
      setLoginStatus("loading");
      setModalVisible(true);
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        await afterGoogleSignIn(result.user);
      } catch (error: any) {
        setModalVisible(false);
        // Si el usuario simplemente cerró el popup, no mostramos error.
        if (
          error?.code !== "auth/popup-closed-by-user" &&
          error?.code !== "auth/cancelled-popup-request"
        ) {
          Alert.alert("Error", "Fallo al iniciar con Google: " + error.message);
        }
      }
      return;
    }

    if (
      GOOGLE_AUTH.webClientId.startsWith("TU_") ||
      !request
    ) {
      Alert.alert(
        "Falta configuración",
        "Todavía no configuraste los Client ID de Google. Revisa src/config/googleAuth.ts"
      );
      return;
    }

    setLoginStatus("loading");
    setModalVisible(true);
    await promptAsync();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <GoogleLoginModal visible={modalVisible} status={loginStatus} />

      <View style={styles.container}>
        <Image
          source={require("./assets/images/logo3.png")}
          style={styles.logo}
        />

        <Text style={styles.title}>Inicia sesión</Text>

        <Text style={styles.label}>Correo ó teléfono</Text>
        <TextInput
          style={styles.input}
          placeholder="Ingresa tu correo o teléfono"
          placeholderTextColor="#AAA"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Ingresa tu contraseña"
          placeholderTextColor="#AAA"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Ingresar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogle}>
          <Image
            source={require("./assets/images/google-ico.png")}
            style={styles.googleIcon}
          />
          <Text style={styles.googleButtonText}>Continuar con Google</Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>¿Aún no tienes una cuenta? </Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.signupLink}>Crea una</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 390,
    height: 124,
    resizeMode: "contain",
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#5D5D5D",
    marginBottom: 30,
  },
  label: {
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#8A8A8A",
    marginBottom: 8,
    marginLeft: 10,
  },
  input: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 20,
    color: "#333",
  },
  loginButton: {
    width: "60%",
    backgroundColor: "#DCDCDC",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  loginButtonText: {
    color: "#FFFEFE",
    fontSize: 16,
    fontWeight: "bold",
  },
  googleButton: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#8A8A8A",
  },
  signupLink: {
    fontSize: 14,
    color: "#83c41a",
    fontWeight: "bold",
  },
});