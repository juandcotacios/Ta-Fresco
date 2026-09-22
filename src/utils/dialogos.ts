import { Alert, Platform } from "react-native";

/**
 * En la versión web de React Native, `Alert.alert` no hace nada: ni muestra el
 * aviso ni ejecuta los botones. Por eso las confirmaciones y avisos que deban
 * funcionar también en el navegador pasan por estas dos funciones.
 */

/** Muestra un aviso simple. */
export function avisar(titulo: string, mensaje?: string): void {
  if (Platform.OS === "web") {
    (globalThis as any).alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    return;
  }
  Alert.alert(titulo, mensaje);
}

/** Pregunta y solo ejecuta `onConfirmar` si el usuario acepta. */
export function confirmar(
  titulo: string,
  mensaje: string,
  onConfirmar: () => void,
  textoConfirmar: string = "Aceptar",
  destructivo: boolean = false
): void {
  if (Platform.OS === "web") {
    if ((globalThis as any).confirm(`${titulo}\n\n${mensaje}`)) onConfirmar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: "Cancelar", style: "cancel" },
    {
      text: textoConfirmar,
      style: destructivo ? "destructive" : "default",
      onPress: onConfirmar,
    },
  ]);
}
