import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface Valoracion {
  id: string;
  pedidoId: string;
  proveedorId: string;
  productoId: string;
  productoNombre: string;
  userId: string;
  rating: number; // 1 a 5
  comentario: string;
}

/** Crea la calificación de UN producto comprado, dentro de un pedido. */
export async function crearValoracion(
  pedidoId: string,
  proveedorId: string,
  productoId: string,
  productoNombre: string,
  userId: string,
  rating: number,
  comentario: string
): Promise<void> {
  if (rating < 1 || rating > 5) throw new Error("La calificación debe ser entre 1 y 5.");
  await addDoc(collection(db, "valoraciones"), {
    pedidoId,
    proveedorId,
    productoId,
    productoNombre,
    userId,
    rating,
    comentario: comentario.trim(),
    createdAt: serverTimestamp(),
  });
}

/** Trae todas las valoraciones que hizo este usuario (para saber qué productos ya calificó). */
export async function obtenerValoracionesUsuario(userId: string): Promise<Valoracion[]> {
  const q = query(collection(db, "valoraciones"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Promedio y cantidad de calificaciones de una TIENDA (agrega las de todos sus productos). */
export async function obtenerPromedioProveedor(
  proveedorId: string
): Promise<{ promedio: number; cantidad: number }> {
  const q = query(collection(db, "valoraciones"), where("proveedorId", "==", proveedorId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { promedio: 0, cantidad: 0 };
  const ratings = snapshot.docs.map((d) => (d.data() as any).rating || 0);
  const promedio = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { promedio, cantidad: ratings.length };
}

/** Promedio y cantidad de calificaciones de UN producto puntual. */
export async function obtenerPromedioProducto(
  productoId: string
): Promise<{ promedio: number; cantidad: number }> {
  const q = query(collection(db, "valoraciones"), where("productoId", "==", productoId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { promedio: 0, cantidad: 0 };
  const ratings = snapshot.docs.map((d) => (d.data() as any).rating || 0);
  const promedio = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { promedio, cantidad: ratings.length };
}