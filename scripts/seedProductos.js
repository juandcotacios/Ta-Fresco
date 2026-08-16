// scripts/seedProductos.js
// Pobla la colección "Productos" (la que la app realmente lee) con datos de ejemplo.
// Uso: node scripts/seedProductos.js

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");

// Mismas credenciales que ya tienes en app/config/firebaseConfig.ts
const firebaseConfig = {
  apiKey: "AIzaSyCEgM0gLhzj9h_rxxczMlsRHhkuCrySw_4",
  authDomain: "tafresco.firebaseapp.com",
  projectId: "tafresco",
  storageBucket: "tafresco.firebasestorage.app",
  messagingSenderId: "799200713865",
  appId: "1:799200713865:web:29963b4fd6c18e0c80ba58",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Categorías válidas según CATEGORIES en app/(tabs)/home.tsx:
// Verduras, Frutas, Tubérculos, Hortalizas, Abarrotes
const productos = [
  { name: "Manzana Roja - kg", price: 4200, category: "Frutas", imageUrl: "https://picsum.photos/seed/manzana/400", stock: 30, featured: true },
  { name: "Banano - kg", price: 2500, category: "Frutas", imageUrl: "https://picsum.photos/seed/banano/400", stock: 40, featured: false },
  { name: "Limón Tahití - kg", price: 3700, category: "Frutas", imageUrl: "https://picsum.photos/seed/limon/400", stock: 25, featured: true },
  { name: "Fresa - canasta", price: 6500, category: "Frutas", imageUrl: "https://picsum.photos/seed/fresa/400", stock: 15, featured: false },

  { name: "Tomate Chonto - kg", price: 3200, category: "Verduras", imageUrl: "https://picsum.photos/seed/tomate/400", stock: 35, featured: true },
  { name: "Zanahoria - kg", price: 2100, category: "Verduras", imageUrl: "https://picsum.photos/seed/zanahoria/400", stock: 40, featured: false },
  { name: "Espinaca - atado", price: 1800, category: "Verduras", imageUrl: "https://picsum.photos/seed/espinaca/400", stock: 20, featured: false },
  { name: "Lechuga Batavia - unidad", price: 2300, category: "Verduras", imageUrl: "https://picsum.photos/seed/lechuga/400", stock: 25, featured: true },

  { name: "Papa Criolla - kg", price: 3900, category: "Tubérculos", imageUrl: "https://picsum.photos/seed/papacriolla/400", stock: 30, featured: true },
  { name: "Yuca - kg", price: 2600, category: "Tubérculos", imageUrl: "https://picsum.photos/seed/yuca/400", stock: 20, featured: false },
  { name: "Papa Pastusa - kg", price: 2900, category: "Tubérculos", imageUrl: "https://picsum.photos/seed/papapastusa/400", stock: 35, featured: false },

  { name: "Cebolla Cabezona - kg", price: 3100, category: "Hortalizas", imageUrl: "https://picsum.photos/seed/cebolla/400", stock: 28, featured: false },
  { name: "Pimentón - kg", price: 4500, category: "Hortalizas", imageUrl: "https://picsum.photos/seed/pimenton/400", stock: 18, featured: true },
  { name: "Ajo - kg", price: 8900, category: "Hortalizas", imageUrl: "https://picsum.photos/seed/ajo/400", stock: 10, featured: false },

  { name: "Arroz Diana - libra", price: 2400, category: "Abarrotes", imageUrl: "https://picsum.photos/seed/arroz/400", stock: 50, featured: true },
  { name: "Panela Redonda - unidad", price: 2200, category: "Abarrotes", imageUrl: "https://picsum.photos/seed/panela/400", stock: 45, featured: false },
  { name: "Frijol Cargamanto - libra", price: 5800, category: "Abarrotes", imageUrl: "https://picsum.photos/seed/frijol/400", stock: 22, featured: false },
];

async function seed() {
  console.log(`Subiendo ${productos.length} productos a la colección "Productos"...`);
  for (const producto of productos) {
    try {
      await addDoc(collection(db, "Productos"), producto);
      console.log(`✔ ${producto.name}`);
    } catch (e) {
      console.error(`✘ Error subiendo ${producto.name}:`, e.message);
    }
  }
  console.log("Listo.");
  process.exit(0);
}

seed();
