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
  ActivityIndicator,
} from "react-native";

import GoogleLoginModal from "@/components/GoogleLoginModal";

import { auth, db } from "@/src/config/firebase";
import { GOOGLE_AUTH } from "@/src/config/googleAuth";
import { traducirErrorAuth, esCorreoValido } from "@/src/utils/authErrors";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'loading' | 'success'>('loading');

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
      setErrorMsg("No se pudo iniciar sesión con Google.");
    } else if (response?.type === "cancel" || response?.type === "dismiss") {
      setModalVisible(false);
    }
  }, [response]);

  const handleLogin = async () => {
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Ingresa tu correo y contraseña.");
      return;
    }
    if (!esCorreoValido(email)) {
      setErrorMsg("Escribe un correo válido (ej: nombre@correo.com).");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/(tabs)/home");
    } catch (error: any) {
      console.log(error);
      setErrorMsg(traducirErrorAuth(error));
    } finally {
      setLoading(false);
    }
  };

  const afterGoogleSignIn = async (user: User) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        nickname: user.displayName || "Usuario Google",
        email: user.email,
        photoURL: user.photoURL || "",
        phone: "",
        role: "cliente",
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
      setErrorMsg(traducirErrorAuth(error));
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    if (Platform.OS === "web") {
      setLoginStatus("loading");
      setModalVisible(true);
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        await afterGoogleSignIn(result.user);
      } catch (error: any) {
        setModalVisible(false);
        if (
          error?.code !== "auth/popup-closed-by-user" &&
          error?.code !== "auth/cancelled-popup-request"
        ) {
          setErrorMsg(traducirErrorAuth(error));
        }
      }
      return;
    }

    if (GOOGLE_AUTH.webClientId.startsWith("TU_") || !request) {
      setErrorMsg("Falta configurar los Client ID de Google (revisa src/config/googleAuth.ts).");
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

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

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

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>Ingresar</Text>}
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
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#5D5D5D",
    marginBottom: 15,
  },
  errorBox: {
    backgroundColor: "#FFEBEE",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 15,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
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
    backgroundColor: "#83c41a",
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