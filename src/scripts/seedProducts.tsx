import { addDoc, collection } from "firebase/firestore";
import { db } from "../services/firebase";

const sampleProducts = [
  {
    name: "Limón Tahití Segunda - kg",
    price: 3736,
    category: "Fruta",
    imageUrl: "https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.buyfrescapp.com%2F&psig=AOvVaw1mngFlSOSO9HUASruA4Zxe&ust=1761859050526000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCND3j8iqypADFQAAAAAdAAAAABAE",
    stock: 10,
    featured: true
  },
  {
    name: "Chaqueta impermeable",
    description: "Ideal para lluvia, material liviano.",
    price: 220000,
    category: "Chaquetas",
    imageUrl: "https://i.imgur.com/FvF2Jxe.jpg",
    stock: 5,
    featured: false
  },
  {
    name: "Kit de transmisión DID",
    description: "Incluye piñón, corona y cadena reforzada.",
    price: 300000,
    category: "Repuestos",
    imageUrl: "https://i.imgur.com/OpG9V2R.jpg",
    stock: 15,
    featured: true
  },
  {
    name: "Aceite Motul 7100 10W40",
    description: "Aceite 100% sintético para alto rendimiento.",
    price: 48000,
    category: "Aceites",
    imageUrl: "https://i.imgur.com/wzQEh6h.jpg",
    stock: 20,
    featured: true
  }
];

export const seedProducts = async () => {
  try {
    for (const product of sampleProducts) {
      await addDoc(collection(db, "products"), product);
    }
    console.log("Productos agregados correctamente!");
  } catch (error) {
    console.error("Error al agregar productos:", error);
  }
};
