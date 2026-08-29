import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface Tienda {
  ownerId: string;
  nombre: string;
  descripcion: string;
}

export interface TiendaConId extends Tienda {
  id: string;
}

export interface ProductoTendero {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  proveedorId: string;
  discountPercent?: number;
}

/** Trae la tienda del proveedor logueado (o null si aún no la ha creado). */
export async function obtenerMiTienda(uid: string): Promise<Tienda | null> {
  const snap = await getDoc(doc(db, "tiendas", uid));
  return snap.exists() ? (snap.data() as Tienda) : null;
}

/** Trae una tienda por su id (uid del dueño). Uso: vista de cliente. */
export async function obtenerTiendaPorId(id: string): Promise<TiendaConId | null> {
  const snap = await getDoc(doc(db, "tiendas", id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Tienda) }) : null;
}

/** Trae todas las tiendas registradas. Uso: vista de cliente ("Tiendas"). */
export async function obtenerTodasLasTiendas(): Promise<TiendaConId[]> {
  const snapshot = await getDocs(collection(db, "tiendas"));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Tienda) }));
}

/** Crea o actualiza los datos de la tienda del proveedor. Un documento por uid. */
export async function guardarMiTienda(
  uid: string,
  nombre: string,
  descripcion: string
): Promise<void> {
  await setDoc(
    doc(db, "tiendas", uid),
    { ownerId: uid, nombre, descripcion, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Trae los productos de un proveedor dado (sirve tanto para "mis productos" como para ver la vitrina de otra tienda). */
export async function obtenerMisProductos(uid: string): Promise<ProductoTendero[]> {
  const q = query(collection(db, "Productos"), where("proveedorId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Crea un producto nuevo para el catálogo, asociado al proveedor. */
export async function crearProducto(
  uid: string,
  data: {
    name: string;
    price: number;
    category: string;
    imageUrl: string;
    stock: number;
    discountPercent?: number;
  }
): Promise<string> {
  const docRef = await addDoc(collection(db, "Productos"), {
    ...data,
    discountPercent: data.discountPercent || 0,
    proveedorId: uid,
    featured: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function actualizarProducto(
  productoId: string,
  data: Partial<{
    name: string;
    price: number;
    category: string;
    imageUrl: string;
    stock: number;
    discountPercent: number;
  }>
): Promise<void> {
  await updateDoc(doc(db, "Productos", productoId), data);
}

/** Trae TODOS los productos del catálogo (uso del panel de administración). */
export async function obtenerTodosLosProductos(): Promise<ProductoTendero[]> {
  const snapshot = await getDocs(collection(db, "Productos"));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function eliminarProducto(productoId: string): Promise<void> {
  await deleteDoc(doc(db, "Productos", productoId));
}