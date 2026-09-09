/** Traduce los códigos de error de Firebase Auth a mensajes claros en español. */
export function traducirErrorAuth(error: any): string {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "El correo no tiene un formato válido.";
    case "auth/user-disabled":
      return "Esta cuenta fue deshabilitada. Contacta soporte.";
    case "auth/user-not-found":
      return "No existe ninguna cuenta con ese correo.";
    case "auth/wrong-password":
      return "La contraseña es incorrecta.";
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta registrada con ese correo.";
    case "auth/weak-password":
      return "La contraseña es muy débil (mínimo 6 caracteres).";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión a internet. Revisa tu red e intenta de nuevo.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // el usuario cerró el popup a propósito, no es un error real
    default:
      return "Ocurrió un error inesperado. Intenta de nuevo.";
  }
}

/**
 * Valida que una contraseña sea razonablemente fuerte.
 * Devuelve un mensaje de error, o null si la contraseña es válida.
 */
export function validarContrasenaFuerte(password: string): string | null {
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  return null;
}

/** Validación básica de formato de correo. */
export function esCorreoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}