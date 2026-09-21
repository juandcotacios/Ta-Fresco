import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

/** Documento `solicitudesTienda/{id}`: petición de un cliente para convertirse en tendero. */
export interface SolicitudTienda {
  userId: string;
  nombre: string;
  descripcion: string;
  estado: EstadoSolicitud;
  createdAt?: Timestamp;
  /** uid del administrador que la aprobó o rechazó. */
  resueltaPor?: string;
  resueltaEn?: Timestamp;
}

export interface SolicitudTiendaConId extends SolicitudTienda {
  id: string;
}

const COLECCION = "solicitudesTienda";

function aMillis(s: SolicitudTienda): number {
  return s.createdAt?.toMillis?.() ?? 0;
}

function mapear(d: { id: string; data: () => unknown }): SolicitudTiendaConId {
  return { id: d.id, ...(d.data() as SolicitudTienda) };
}

/** Un cliente envía su solicitud; queda "pendiente" hasta que un admin la resuelva. */
export async function crearSolicitud(
  userId: string,
  nombre: string,
  descripcion: string
): Promise<void> {
  await addDoc(collection(db, COLECCION), {
    userId,
    nombre,
    descripcion,
    estado: "pendiente" as EstadoSolicitud,
    createdAt: serverTimestamp(),
  });
}

/** Solicitud más reciente de este usuario, o null si nunca ha enviado una. */
export async function obtenerMiSolicitud(
  userId: string
): Promise<SolicitudTiendaConId | null> {
  const snapshot = await getDocs(query(collection(db, COLECCION), where("userId", "==", userId)));
  const lista = snapshot.docs.map(mapear).sort((a, b) => aMillis(b) - aMillis(a));
  return lista[0] ?? null;
}

/** Solicitudes por resolver, de la más antigua a la más reciente. Uso: panel de administración. */
export async function obtenerSolicitudesPendientes(): Promise<SolicitudTiendaConId[]> {
  const snapshot = await getDocs(
    query(collection(db, COLECCION), where("estado", "==", "pendiente"))
  );
  return snapshot.docs.map(mapear).sort((a, b) => aMillis(a) - aMillis(b));
}

/**
 * Aprueba la solicitud: marca la solicitud como aprobada y le da el rol de tendero
 * al solicitante, ambas cosas en una sola operación para que no queden a medias.
 * Si el usuario ya no es "cliente" (p. ej. ya es admin) no se le cambia el rol.
 */
export async function aprobarSolicitud(
  solicitud: SolicitudTiendaConId,
  adminUid: string
): Promise<void> {
  const userRef = doc(db, "users", solicitud.userId);
  const userSnap = await getDoc(userRef);
  const rolActual = userSnap.data()?.role ?? "cliente";

  const batch = writeBatch(db);
  if (rolActual === "cliente") batch.update(userRef, { role: "tendero" });
  batch.update(doc(db, COLECCION, solicitud.id), {
    estado: "aprobada" as EstadoSolicitud,
    resueltaPor: adminUid,
    resueltaEn: serverTimestamp(),
  });
  await batch.commit();
}

/** Rechaza la solicitud. El usuario conserva su rol y puede enviar una nueva. */
export async function rechazarSolicitud(
  solicitud: SolicitudTiendaConId,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(db, COLECCION, solicitud.id), {
    estado: "rechazada" as EstadoSolicitud,
    resueltaPor: adminUid,
    resueltaEn: serverTimestamp(),
  });
}
