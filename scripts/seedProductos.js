// Carga idempotente de una tienda y un catálogo de demostración.
// Requiere un usuario Firebase existente con rol "tendero".

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const productos = [
  ["Frutas", "Aguacate Hass - unidad", 3800, 24],
  ["Frutas", "Banano - kg", 2500, 40],
  ["Frutas", "Fresa - canasta", 6500, 15],
  ["Frutas", "Limón Tahití - kg", 3700, 25],
  ["Frutas", "Mango Tommy - kg", 4200, 20],
  ["Frutas", "Manzana Roja - kg", 6200, 30],
  ["Frutas", "Naranja Valencia - kg", 3000, 35],
  ["Frutas", "Papaya - unidad", 5500, 12],

  ["Verduras", "Acelga - atado", 2200, 18],
  ["Verduras", "Espinaca - atado", 2500, 20],
  ["Verduras", "Lechuga Batavia - unidad", 2300, 25],
  ["Verduras", "Pepino Cohombro - kg", 2800, 22],
  ["Verduras", "Tomate Chonto - kg", 3800, 35],
  ["Verduras", "Zanahoria - kg", 2600, 40],

  ["Tuberculos", "Arracacha - kg", 4200, 16],
  ["Tuberculos", "Papa Criolla - kg", 4500, 30],
  ["Tuberculos", "Papa Pastusa - kg", 3200, 35],
  ["Tuberculos", "Plátano Verde - unidad", 1800, 30],
  ["Tuberculos", "Yuca - kg", 3000, 20],

  ["Hortalizas", "Ajo - kg", 9800, 10],
  ["Hortalizas", "Cebolla Cabezona - kg", 3500, 28],
  ["Hortalizas", "Cebolla Larga - atado", 2200, 24],
  ["Hortalizas", "Cilantro - atado", 1500, 20],
  ["Hortalizas", "Pimentón - kg", 5200, 18],

  ["Abarrotes", "Arroz - libra", 2600, 50],
  ["Abarrotes", "Fríjol Cargamanto - libra", 6200, 22],
  ["Abarrotes", "Lenteja - libra", 3200, 30],
  ["Abarrotes", "Panela Redonda - unidad", 2500, 45],
  ["Abarrotes", "Aceite Vegetal - litro", 9800, 18],

  ["Carnes", "Carne de Res Molida - kg", 22000, 15],
  ["Carnes", "Costilla de Cerdo - kg", 18500, 10],
  ["Carnes", "Filete de Tilapia - kg", 19000, 12],
  ["Carnes", "Pechuga de Pollo - kg", 16500, 20],
  ["Carnes", "Pierna Pernil de Pollo - kg", 11500, 18],
];

const categoriaImagenEnv = {
  Frutas: "SEED_IMAGE_FRUTAS_URL",
  Verduras: "SEED_IMAGE_VERDURAS_URL",
  Tuberculos: "SEED_IMAGE_TUBERCULOS_URL",
  Hortalizas: "SEED_IMAGE_HORTALIZAS_URL",
  Abarrotes: "SEED_IMAGE_ABARROTES_URL",
  Carnes: "SEED_IMAGE_CARNES_URL",
};

function requerido(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre} en .env.`);
  return valor;
}

function imageUrlFor(category) {
  const envName = categoriaImagenEnv[category];
  const url = process.env[envName] || process.env.SEED_PRODUCT_IMAGE_URL;
  if (!url) {
    throw new Error(
      `Configura ${envName} o SEED_PRODUCT_IMAGE_URL con una URL de imagen de Cloudinary.`
    );
  }
  if (!/^https:\/\/res\.cloudinary\.com\//i.test(url)) {
    throw new Error(`${envName} debe ser una URL https://res.cloudinary.com/...`);
  }
  return url;
}

function slug(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seed() {
  const missingFirebaseConfig = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingFirebaseConfig.length) {
    throw new Error(`Falta configuración de Firebase: ${missingFirebaseConfig.join(", ")}`);
  }

  const email = requerido("SEED_TENDERO_EMAIL");
  const password = requerido("SEED_TENDERO_PASSWORD");
  // Validar imágenes antes de conectarse para evitar una carga parcial.
  const imagenes = Object.fromEntries(
    Object.keys(categoriaImagenEnv).map((category) => [category, imageUrlFor(category)])
  );

  const app = initializeApp(firebaseConfig, "seed-demo-catalog");
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    const profile = await getDoc(doc(db, "users", uid));
    if (!profile.exists() || profile.data().role !== "tendero") {
      throw new Error("La cuenta configurada debe existir en Firebase y tener rol tendero.");
    }

    const tiendaRef = doc(db, "tiendas", uid);
    const tienda = await getDoc(tiendaRef);
    if (!tienda.exists()) {
      await setDoc(tiendaRef, {
        ownerId: uid,
        nombre: "Frutas y Verduras La Esquina (Demo)",
        descripcion: "Tienda de demostración con productos variados para probar Ta Fresco.",
        updatedAt: serverTimestamp(),
      });
      console.log("Tienda de demostración creada.");
    } else {
      console.log(`Se conservará la tienda existente: ${tienda.data().nombre || uid}`);
    }

    let creados = 0;
    let existentes = 0;
    for (const [category, name, price, stock] of productos) {
      const id = `demo-${slug(name)}`;
      const productoRef = doc(collection(db, "Productos"), id);
      const productoExistente = await getDoc(productoRef);
      if (productoExistente.exists()) {
        if (productoExistente.data().proveedorId !== uid) {
          throw new Error(`El ID reservado ${id} ya pertenece a otra cuenta; se detuvo la carga.`);
        }
        existentes += 1;
        continue;
      }

      await setDoc(productoRef, {
        name,
        price,
        category,
        imageUrl: imagenes[category],
        stock,
        discountPercent: 0,
        proveedorId: uid,
        createdAt: serverTimestamp(),
      });
      creados += 1;
      console.log(`+ ${name}`);
    }

    console.log(`Carga terminada: ${creados} productos nuevos, ${existentes} ya existentes.`);
  } finally {
    await signOut(auth);
  }
}

seed().catch((error) => {
  console.error(`No se pudo completar la carga: ${error.message}`);
  process.exitCode = 1;
});
