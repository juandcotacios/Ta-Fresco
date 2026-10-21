import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";

import { GOOGLE_AUTH } from "@/src/config/googleAuth";

GoogleOneTapSignIn.configure({
  webClientId: GOOGLE_AUTH.webClientId,
});

export async function signInWithGoogleNative(): Promise<string | null> {
  await GoogleOneTapSignIn.checkPlayServices();

  // Show Google's account chooser on every tap so the user can switch accounts.
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
