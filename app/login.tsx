import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import GoogleLoginModal from "@/components/GoogleLoginModal";
import Logo from "@/components/Logo";

import { colors, radius, shadow, spacing } from "@/constants/designSystem";
import { auth, db } from "@/src/config/firebase";
import { GOOGLE_AUTH } from "@/src/config/googleAuth";
import { esCorreoValido, traducirErrorAuth } from "@/src/utils/authErrors";

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
        createdAt: serverTimestamp(),
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
        <View style={styles.logoWrap}>
          <Logo variant="dark" size="lg" />
        </View>

        <Text style={styles.title}>Inicia sesión</Text>
        <Text style={styles.subtitle}>Qué bueno verte de nuevo</Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Correo ó teléfono</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu correo o teléfono"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu contraseña"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Ingresar</Text>}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogle} activeOpacity={0.85}>
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
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  logoWrap: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    width: "100%",
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  label: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    marginLeft: 6,
    fontWeight: "600",
  },
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
  },
  loginButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.button,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: colors.textMuted,
    fontSize: 13,
  },
  googleButton: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "800",
  },
});
