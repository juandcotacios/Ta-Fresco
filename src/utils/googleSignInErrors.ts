export function mensajeErrorGoogleAndroid(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;

  if (code === "DEVELOPER_ERROR") {
    return "Google no está configurado para la firma de este APK. Verifica el paquete com.juandcotacios.tafresco y agrega la huella SHA-1 del certificado EAS en el cliente OAuth Android de Google Cloud.";
  }

  if (code === "PLAY_SERVICES_NOT_AVAILABLE") {
    return "Actualiza Google Play Services e inténtalo de nuevo.";
  }

  return "No se pudo iniciar sesión con Google. Inténtalo de nuevo.";
}
