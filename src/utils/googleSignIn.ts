export async function signInWithGoogleNative(): Promise<string | null> {
  throw new Error("El inicio nativo de Google solo está disponible en Android.");
}

export async function signOutGoogleNative(): Promise<void> {
  // En plataformas que usan AuthSession no hay una sesión nativa de Google que limpiar.
}
