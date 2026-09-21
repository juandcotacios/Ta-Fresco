import { collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/src/config/firebase";

export type Rol = "cliente" | "tendero" | "admin";

/** Documento `users/{uid}` con los 6 campos que realmente se guardan en Firestore. */
export interface Usuario {
  nickname?: string;
  email?: string;
  photoURL?: string;
  phone?: string;
  role?: Rol;
  createdAt?: Timestamp;
}

/** Usuario junto con el id de su documento (el uid de Firebase Auth). */
export interface UsuarioConId extends Usuario {
  id: string;
}

/** Datos de contacto del comprador que ven el tendero y el admin en los pedidos. */
export type Comprador = Pick<Usuario, "nickname" | "phone" | "email">; 

/** Documento `users/{uid}/addresses/{id}`: dirección de entrega guardada por el usuario. */
export interface Direccion {
  id: string;
  name: string;
  addressLine: string;
  createdAt?: Timestamp;
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