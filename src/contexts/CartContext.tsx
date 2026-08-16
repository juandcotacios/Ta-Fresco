import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, onAuthStateChanged } from "firebase/auth"; 

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  category: string;
  stock?: number;
}


interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  decreaseCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const auth = getAuth(); 

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

 

  const addToCart = (item: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((i) => i.id === item.id);
      if (existingItem) {
        return prevCart.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prevCart, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const decreaseCart = (id: string) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: Math.max(1, item.quantity - 1) };
        }
        return item;
      });
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, decreaseCart, clearCart }}
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