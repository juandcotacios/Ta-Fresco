import { exchangeCodeAsync } from "expo-auth-session";
import type {
  AuthRequest,
  AuthRequestPromptOptions,
  AuthSessionResult,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";

import { GOOGLE_AUTH } from "@/src/config/googleAuth";

// iOS uses the browser-based PKCE flow so simulator sign-in does not depend
// on Google Sign-In's native Keychain access group.
export async function signInWithGoogleIOSAuthSession(
  request: AuthRequest | null,
  promptAsync: (
    options?: AuthRequestPromptOptions
  ) => Promise<AuthSessionResult>
): Promise<string | null> {
  if (!request) {
    throw new Error("Google todavía está preparando el inicio de sesión.");
  }

  const response = await promptAsync();

  if (response.type === "cancel" || response.type === "dismiss") {
    return null;
  }

  if (response.type !== "success") {
    throw new Error(
      response.type === "error"
        ? response.error?.message || "Google no pudo autorizar la aplicación."
        : "Google no pudo completar la autorización."
    );
  }

  const code = response.params.code;
  if (!code || !request.codeVerifier) {
    throw new Error("Google no devolvió el código seguro de autorización.");
  }

  const tokenResponse = await exchangeCodeAsync(
    {
      clientId: GOOGLE_AUTH.iosClientId,
      code,
      redirectUri: request.redirectUri,
      scopes: request.scopes,
      extraParams: { code_verifier: request.codeVerifier },
    },
    Google.discovery
  );

  if (!tokenResponse.idToken) {
    throw new Error("Google no devolvió un ID token para Firebase.");
  }

  return tokenResponse.idToken;
}
