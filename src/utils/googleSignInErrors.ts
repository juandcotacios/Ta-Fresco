export function mensajeErrorGoogleAndroid(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/NitroModules|Turbo\/Native-Module could not be found/i.test(message)) {
    return "Esta instalación no incluye el módulo nativo de Google. Para iniciar con Google, instala el APK de Ta Fresco; Expo Go no es compatible.";
  }

  const code = (error as { code?: string } | null)?.code;

  if (code === "DEVELOPER_ERROR") {
    return "Google no está configurado para la firma de este APK. Verifica el paquete com.juandcotacios.tafresco y agrega la huella SHA-1 del certificado EAS en el cliente OAuth Android de Google Cloud.";
  }

  if (code === "PLAY_SERVICES_NOT_AVAILABLE") {
    return "Actualiza Google Play Services e inténtalo de nuevo.";
  }

  return "No se pudo iniciar sesión con Google. Inténtalo de nuevo.";
}

export function mensajeErrorGoogleIOS(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = (error as { code?: string } | null)?.code;

  if (message.toLowerCase().includes("keychain")) {
    return "Google Sign-In de iOS no pudo acceder al llavero seguro. El fallo ocurre antes de validar la cuenta en Firebase.";
  }

  if (code === "auth/operation-not-allowed") {
    return "El acceso con Google no está habilitado en Firebase Authentication.";
  }

  if (code === "auth/invalid-api-key") {
    return "Firebase rechazó la API key de esta compilación. Revisa la configuración de Firebase en GitHub Actions.";
  }

  if (code === "auth/network-request-failed") {
    return "No hubo respuesta de Firebase. Revisa la conexión del simulador e inténtalo de nuevo.";
  }

  if (code === "auth/invalid-credential" || code === "auth/invalid-idp-response") {
    return "Firebase rechazó el token de Google. Revisa los Client ID de OAuth y que Google esté habilitado en Firebase.";
  }

  return message || "No se pudo iniciar sesión con Google. Inténtalo de nuevo.";
}
