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

export interface ProductoTendero {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  proveedorId: string;
}

/** Trae la tienda del proveedor logueado (o null si aún no la ha creado). */
export async function obtenerMiTienda(uid: string): Promise<Tienda | null> {
  const snap = await getDoc(doc(db, "tiendas", uid));
  return snap.exists() ? (snap.data() as Tienda) : null;
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

/** Trae solo los productos que pertenecen a este proveedor. */
export async function obtenerMisProductos(uid: string): Promise<ProductoTendero[]> {
  const q = query(collection(db, "Productos"), where("proveedorId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Crea un producto nuevo para el catálogo, asociado al proveedor. */
export async function crearProducto(
  uid: string,
  data: { name: string; price: number; category: string; imageUrl: string; stock: number }
): Promise<string> {
  const docRef = await addDoc(collection(db, "Productos"), {
    ...data,
    proveedorId: uid,
    featured: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function actualizarProducto(
  productoId: string,
  data: Partial<{ name: string; price: number; category: string; imageUrl: string; stock: number }>
): Promise<void> {
  await updateDoc(doc(db, "Productos", productoId), data);
}

export async function eliminarProducto(productoId: string): Promise<void> {
  await deleteDoc(doc(db, "Productos", productoId));
}