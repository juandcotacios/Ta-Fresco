import { useAppTheme } from '@/src/contexts/ThemeContext';
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Logo from "@/components/Logo";
import { colors, radius, shadow, spacing } from "@/constants/designSystem";
import { auth, db } from "@/src/config/firebase";
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from "@/src/content/legalDocuments";
import { GOOGLE_AUTH } from "@/src/config/googleAuth";
import { signInWithGoogleNative } from "@/src/utils/googleSignIn";
import { mensajeErrorGoogleAndroid } from "@/src/utils/googleSignInErrors";
import {
  esCorreoValido,
  traducirErrorAuth,
  validarContrasenaFuerte,
} from "@/src/utils/authErrors";

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalDocument, setLegalDocument] = useState<"terms" | "privacy" | null>(null);

  const [request, , promptAsync] =
    Google.useIdTokenAuthRequest({
      clientId: GOOGLE_AUTH.webClientId,
      androidClientId: GOOGLE_AUTH.androidClientId,
      iosClientId: GOOGLE_AUTH.iosClientId,
    });

  // Registro con correo y contraseña.
  const handleRegister = async () => {
    setErrorMsg(null);

    if (!email || !password || !confirm) {
      setErrorMsg("Completa todos los campos.");
      return;
    }

    if (!acceptedLegal) {
      setErrorMsg("Lee y acepta los términos y la política de datos para crear tu cuenta.");
      return;
    }

    if (!esCorreoValido(email)) {
      setErrorMsg(
        "Escribe un correo válido (ej: nombre@correo.com)."
      );
      return;
    }

    const errorContrasena = validarContrasenaFuerte(password);

    if (errorContrasena) {
      setErrorMsg(errorContrasena);
      return;
    }

    if (password !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        nickname: "Usuario Nuevo",
        email: user.email,
        photoURL: "",
        phone: "",
        role: "cliente",
        createdAt: serverTimestamp(),
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "2026-10-20",
        privacyAcceptedAt: serverTimestamp(),
      });

      console.log("Perfil creado exitosamente en Firestore");

      router.replace("/(tabs)/home");
    } catch (error: any) {
      console.log("Error en el registro:", error);
      setErrorMsg(traducirErrorAuth(error));
    } finally {
      setLoading(false);
    }
  };

  // Registro o inicio de sesión con Google.
  const finishGoogleSignIn = async (idToken: string) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const existingProfile = await getDoc(userRef);

      if (!existingProfile.exists()) {
        await setDoc(userRef, {
          nickname: user.displayName || "Usuario Google",
          email: user.email,
          photoURL: user.photoURL || "",
          phone: "",
          role: "cliente",
          createdAt: serverTimestamp(),
        });
      }

      await setDoc(userRef, {
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "2026-10-20",
        privacyAcceptedAt: serverTimestamp(),
      }, { merge: true });

      router.replace("/(tabs)/home");
    } catch (error: any) {
      console.log(
        "Error al registrar o autenticar con Google:",
        error
      );

      setErrorMsg(traducirErrorAuth(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);

    if (!acceptedLegal) {
      setErrorMsg("Lee y acepta los términos y la política de datos para continuar.");
      return;
    }

    if (Platform.OS === "android") {
      setLoading(true);

      try {
        const idToken = await signInWithGoogleNative();

        if (!idToken) {
          setLoading(false);
          return;
        }

        await finishGoogleSignIn(idToken);
      } catch (error: any) {
        console.log("Error de Google en Android:", error);

        setLoading(false);
        setErrorMsg(mensajeErrorGoogleAndroid(error));
      }

      return;
    }

    if (GOOGLE_AUTH.webClientId.startsWith("TU_") || !request) {
      setErrorMsg(
        "Falta configurar los Client ID de Google (revisa src/config/googleAuth.ts)."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await promptAsync();

      if (result.type === "success") {
        const idToken = result.params.id_token;

        if (!idToken) {
          setLoading(false);
          setErrorMsg(
            "Google no devolvió el token de autenticación. Inténtalo de nuevo."
          );
          return;
        }

        await finishGoogleSignIn(idToken);
        return;
      }

      setLoading(false);

      if (result.type === "error") {
        setErrorMsg(
          result.error?.message ||
            "No se pudo iniciar sesión con Google."
        );
      } else if (
        result.type === "dismiss" ||
        result.type === "cancel"
      ) {
        setErrorMsg("Se canceló el registro con Google.");
      } else {
        setErrorMsg("No se pudo completar el registro con Google.");
      }
    } catch (error) {
      console.log(
        "Error al abrir la autenticación de Google:",
        error
      );

      setLoading(false);
      setErrorMsg(
        "No se pudo abrir el registro con Google. Inténtalo de nuevo."
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal visible={legalDocument !== null} animationType="slide" onRequestClose={() => setLegalDocument(null)}>
        <SafeAreaView style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>{legalDocument === "terms" ? "Términos y condiciones" : "Política de datos personales"}</Text>
            <TouchableOpacity onPress={() => setLegalDocument(null)} accessibilityRole="button" accessibilityLabel="Cerrar documento">
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.legalBody}>
            <Text style={styles.legalText}>{legalDocument === "terms" ? TERMS_AND_CONDITIONS : PRIVACY_POLICY}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.legalSicLink} onPress={() => Linking.openURL("https://www.sic.gov.co/")}>
            <Text style={styles.legalLink}>Superintendencia de Industria y Comercio</Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
      <KeyboardAvoidingView
        style={styles.keyboardScreen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Logo variant="dark" size="lg" />
        </View>

        <Text style={styles.title}>Crea una cuenta</Text>

        <Text style={styles.subtitle}>
          Prototipo académico de una plaza digital. Usa solo datos de prueba.
        </Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.danger}
            />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Correo o teléfono</Text>

        <View style={styles.inputWrap}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={colors.textMuted}
            style={styles.inputIcon}
          />

          <TextInput
            style={styles.input}
            placeholder="Ingresa tu correo o teléfono"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>Contraseña</Text>

        <View style={styles.inputWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textMuted}
            style={styles.inputIcon}
          />

          <TextInput
            style={styles.input}
            placeholder="Mínimo 8 caracteres, con letras y números"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>Confirmar contraseña</Text>

        <View style={styles.inputWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textMuted}
            style={styles.inputIcon}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirma tu contraseña"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
        </View>

        <View style={styles.legalConsentRow}>
          <TouchableOpacity
            onPress={() => setAcceptedLegal((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedLegal }}
            style={[styles.legalCheckbox, acceptedLegal && styles.legalCheckboxChecked]}
          >
            {acceptedLegal && <Ionicons name="checkmark" size={17} color={colors.white} />}
          </TouchableOpacity>
          <View style={styles.legalConsentCopy}>
            <Text style={styles.legalConsentText}>Acepto los </Text>
            <TouchableOpacity onPress={() => setLegalDocument("terms")}>
              <Text style={styles.legalLink}>Términos y condiciones</Text>
            </TouchableOpacity>
            <Text style={styles.legalConsentText}> y autorizo el tratamiento de mis datos según la </Text>
            <TouchableOpacity onPress={() => setLegalDocument("privacy")}>
              <Text style={styles.legalLink}>Política de datos</Text>
            </TouchableOpacity>
            <Text style={styles.legalConsentText}>.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.createButtonText}>
              Crear cuenta
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Image
            source={require("./assets/images/google-ico.png")}
            style={styles.googleIcon}
          />
          <Text style={styles.googleButtonText}>
            Continuar con Google
          </Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            ¿Ya tienes cuenta?{" "}
          </Text>

          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.loginLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  keyboardScreen: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  legalConsentRow: { flexDirection: "row", alignItems: "flex-start", width: "100%", marginBottom: spacing.md },
  legalConsentCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  legalCheckbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textMuted, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  legalCheckboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  legalConsentText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  legalLink: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: "700", textDecorationLine: "underline" },
  legalModal: { flex: 1, backgroundColor: colors.background },
  legalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  legalTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  legalBody: { padding: spacing.lg, paddingBottom: 40 },
  legalText: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  legalSicLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  logoWrap: {
    marginBottom: spacing.lg,
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
    textAlign: "center",
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
  createButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.button,
  },
  createButtonText: {
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
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
});
