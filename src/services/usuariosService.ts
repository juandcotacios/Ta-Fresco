import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";

export type Rol = "cliente" | "tendero" | "admin";

export interface UsuarioConId {
  id: string;
  nickname?: string;
  email?: string;
  role?: Rol;
}

/** Trae todos los usuarios registrados. Uso: panel de administración. */
export async function obtenerTodosLosUsuarios(): Promise<UsuarioConId[]> {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Cambia el rol de un usuario. Solo puede ejecutarlo un admin (lo valida Firestore Rules). */
export async function actualizarRolUsuario(uid: string, role: Rol): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}