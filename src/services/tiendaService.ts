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
  limit,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface Tienda {
  ownerId: string;
  nombre: string;
  descripcion: string;
  /** Se escribe en cada guardado (guardarMiTienda). */
  updatedAt?: Timestamp;
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
  /** Porcentaje de descuento; 0 = sin descuento. Siempre es un número al leerlo (ver docAProducto). */
  discountPercent: number;
  /** Lo escribe crearProducto; los productos cargados con el seed no lo tienen. */
  createdAt?: Timestamp;
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
/**
 * Convierte un documento de `Productos` en `ProductoTendero`.
 * `discountPercent` se normaliza a 0 porque los productos cargados con el seed
 * no traen el campo, así que las pantallas siempre reciben un número.
 */
function docAProducto(d: QueryDocumentSnapshot): ProductoTendero {
  const data = d.data() as any;
  return { id: d.id, ...data, discountPercent: Number(data.discountPercent) || 0 };
}

export async function obtenerMisProductos(uid: string): Promise<ProductoTendero[]> {
  const q = query(collection(db, "Productos"), where("proveedorId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docAProducto);
}

/**
 * Valida los campos de un producto antes de guardarlo. Las pantallas (tienda
 * y admin) ya validan en el formulario, pero el servicio es el único punto
 * por el que pasan TODAS las escrituras, así que repetir la validación acá
 * evita que un formulario nuevo, o una llamada futura, guarde datos inválidos
 * sin darse cuenta (precio negativo, stock negativo, nombre vacío, etc.).
 * Firestore Rules aplica la misma regla del lado del servidor.
 */
function validarCamposProducto(data: {
  name?: string;
  price?: number;
  stock?: number;
  discountPercent?: number;
}): void {
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error("El producto necesita un nombre.");
  }
  if (data.price !== undefined && (isNaN(data.price) || data.price <= 0)) {
    throw new Error("El precio debe ser mayor a 0.");
  }
  if (data.stock !== undefined && (isNaN(data.stock) || data.stock < 0)) {
    throw new Error("El stock no puede ser negativo.");
  }
  if (
    data.discountPercent !== undefined &&
    (isNaN(data.discountPercent) || data.discountPercent < 0 || data.discountPercent > 90)
  ) {
    throw new Error("El descuento debe estar entre 0 y 90%.");
  }
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
  validarCamposProducto(data);
  const docRef = await addDoc(collection(db, "Productos"), {
    ...data,
    discountPercent: data.discountPercent || 0,
    proveedorId: uid,
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
  validarCamposProducto(data);
  await updateDoc(doc(db, "Productos", productoId), data);
}

/**
 * Trae productos del catálogo para el panel de administración (hasta 500).
 * El catálogo que ven los compradores (home) se suscribe directo a la colección
 * completa porque ahí la búsqueda necesita verlo todo; este tope solo aplica
 * a la vista de admin, para no leer (y pagar) toda la colección en cada visita
 * a medida que crece. Si el catálogo supera los 500 productos, hay que
 * agregar paginación real en vez de subir el número.
 */
export async function obtenerTodosLosProductos(): Promise<ProductoTendero[]> {
  const snapshot = await getDocs(query(collection(db, "Productos"), limit(500)));
  return snapshot.docs.map(docAProducto);
}

export async function eliminarProducto(productoId: string): Promise<void> {
  await deleteDoc(doc(db, "Productos", productoId));
}