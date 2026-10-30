import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";

import { GOOGLE_AUTH } from "@/src/config/googleAuth";

GoogleOneTapSignIn.configure({
  webClientId: GOOGLE_AUTH.webClientId,
  iosClientId: GOOGLE_AUTH.iosClientId,
});

export async function signInWithGoogleNative(): Promise<string | null> {
  if (GOOGLE_AUTH.iosClientId.startsWith("TU_")) {
    throw new Error(
      "Configura EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID en .env y en el entorno de EAS antes de usar Google en iPhone."
    );
  }

  const response = await GoogleOneTapSignIn.presentExplicitSignIn();

  if (isCancelledResponse(response)) {
    return null;
  }

  if (!isSuccessResponse(response)) {
    throw new Error("Google no pudo completar la autenticación.");
  }

  const { idToken } = response.data;
  if (!idToken) {
    throw new Error(
      "Google no devolvió un ID token. Verifica el cliente OAuth web configurado."
    );
  }

  return idToken;
}

export async function signOutGoogleNative(): Promise<void> {
  await GoogleOneTapSignIn.signOut();
}
