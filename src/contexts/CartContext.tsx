import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/src/config/firebase";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  category: string;
  stock?: number;
  proveedorId?: string;
  discountPercent?: number;
}


interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  increaseCart: (id: string) => void;
  decreaseCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); 

  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        
        setUserId(user.uid);
        await loadCart(user.uid);
      } else {
        
        setUserId(null);
        setCart([]); 
      }
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  
  const loadCart = async (uid: string) => {
    try {
      
      const savedCart = await AsyncStorage.getItem(`cart_${uid}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      } else {
        setCart([]); 
      }
    } catch (error) {
      console.log("Error cargando carrito:", error);
    }
  };

  
  useEffect(() => {
    const saveCart = async () => {
      
      if (isInitialized && userId) {
        try {
          await AsyncStorage.setItem(`cart_${userId}`, JSON.stringify(cart));
        } catch (error) {
          console.log("Error guardando carrito:", error);
        }
      }
    };
    saveCart();
  }, [cart, userId, isInitialized]);

  /**
   * El stock guardado en cada línea del carrito es una FOTO del momento en que
   * se agregó el producto, y nunca se actualizaba sola. Si el stock real bajaba
   * después (otra compra, o el tendero lo ajustaba), el carrito seguía dejando
   * sumar contra ese número viejo. Esto lo mantiene sincronizado con Firestore
   * en tiempo real mientras el producto siga en el carrito, y si el stock real
   * ya no alcanza para la cantidad que hay, la baja sola (o quita la línea si
   * llega a 0). La compra sigue validando el stock otra vez al confirmar, así
   * que esto es solo para que la persona lo vea correcto ANTES de llegar ahí.
   *
   * Si el stock llega a 0 la línea NO se borra sola: se conserva con stock:0
   * para que la pantalla la muestre como "Agotado" (igual que en el catálogo),
   * en vez de hacerla desaparecer del carrito sin explicación. La cantidad que
   * la persona quería se conserva por si el producto vuelve a tener stock.
   */
  const idsEnCarrito = Array.from(new Set(cart.map((i) => i.id))).sort().join(",");
  useEffect(() => {
    const ids = idsEnCarrito ? idsEnCarrito.split(",") : [];
    if (ids.length === 0) return;

    // La cláusula "in" de Firestore admite hasta 30 valores; un carrito con
    // más productos distintos que eso es un caso raro, se cubre por bloques.
    const bloques: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) bloques.push(ids.slice(i, i + 30));

    const unsubs = bloques.map((bloque) =>
      onSnapshot(
        query(collection(db, "Productos"), where(documentId(), "in", bloque)),
        (snapshot) => {
          const stockReal: Record<string, number> = {};
          snapshot.docs.forEach((d) => {
            stockReal[d.id] = (d.data() as any).stock ?? 0;
          });
          setCart((prevCart) =>
            prevCart.map((item) => {
              if (!(item.id in stockReal)) return item; // fuera de este bloque
              const stock = stockReal[item.id];
              if (item.stock === stock && (stock <= 0 || item.quantity <= stock)) return item;
              // Con algo de stock (aunque sea menos de lo que había) se ajusta la
              // cantidad; agotado del todo, se deja la cantidad tal cual estaba.
              const quantity = stock > 0 ? Math.min(item.quantity, stock) : item.quantity;
              return { ...item, stock, quantity };
            })
          );
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [idsEnCarrito]);


  /**
   * Agrega un producto al carrito, o suma unidades si ya estaba, sin pasar
   * nunca del stock del producto (mismo límite que increaseCart). Antes esta
   * función no validaba nada, así que cualquier pantalla que no se protegiera
   * a mano dejaba agregar más unidades de las que había en el catálogo.
   */
  const addToCart = (item: CartItem) => {
    setCart((prevCart) => {
      const tope = item.stock ?? Infinity;
      const existingItem = prevCart.find((i) => i.id === item.id);
      if (existingItem) {
        const cantidad = Math.min(existingItem.quantity + (item.quantity || 1), tope);
        return prevCart.map((i) => (i.id === item.id ? { ...i, quantity: cantidad } : i));
      }
      if (tope <= 0) return prevCart; // producto sin stock
      const cantidad = Math.min(item.quantity || 1, tope);
      return [...prevCart, { ...item, quantity: cantidad }];
    });
  };

  /** Suma 1 a una línea que ya está en el carrito, sin pasar del stock disponible. */
  const increaseCart = (id: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id && item.quantity < (item.stock ?? Infinity)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  /** Resta 1 a la línea; si solo tenía 1 unidad, la quita del carrito. */
  const decreaseCart = (id: string) => {
    setCart((prevCart) =>
      prevCart.flatMap((item) => {
        if (item.id !== id) return [item];
        return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [];
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, increaseCart, decreaseCart, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};