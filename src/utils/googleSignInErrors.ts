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
