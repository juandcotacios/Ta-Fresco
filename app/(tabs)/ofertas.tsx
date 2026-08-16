import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore"; 
import { db } from "@/src/config/firebase"; 
import { useCart } from "@/src/contexts/CartContext";
import OpenChatbotButton from "../../components/OpenChatbotButton";

const { width, height } = Dimensions.get('window');
const MIN_ORDER_AMOUNT = 100000;
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? 90 : 70;

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  oldPrice?: number;
  discountTag?: string;
  quantity?: number; 
}

const CATEGORIES = [
  { name: "Verduras", icon: require("../assets/categorias/verduras.png") },
  { name: "Frutas", icon: require("../assets/categorias/frutas.png") },
  { name: "Tubérculos", icon: require("../assets/categorias/tuberculos.png") },
  { name: "Hortalizas", icon: require("../assets/categorias/hortalizas.png") },
  { name: "Abarrotes", icon: require("../assets/categorias/abarrotes.png") },
];

export default function OfertasScreen() {
  const router = useRouter();
  const { cart, addToCart, decreaseCart, removeFromCart } = useCart();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topOffers, setTopOffers] = useState<Product[]>([]);
  const [superDiscounts, setSuperDiscounts] = useState<Product[]>([]);

  const [miniCartVisible, setMiniCartVisible] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  const totalPrice = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const isMinMet = totalPrice >= MIN_ORDER_AMOUNT;

  const loadOffers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "Productos"));
      const productsData: Product[] = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        const currentPrice = data.price || 0;
        const randomDiscount = Math.floor(Math.random() * (40 - 10 + 1)) + 10; 
        const calculatedOldPrice = Math.floor(currentPrice * (1 + randomDiscount / 100));

        return {
          id: doc.id,
          name: data.name || "Producto sin nombre",
          price: currentPrice,
          imageUrl: data.imageUrl || "https://via.placeholder.com/150",
          category: data.category || "Varios",
          stock: data.stock || 0,
          oldPrice: calculatedOldPrice,
          discountTag: `-${randomDiscount}%`,
        };
      });

      const shuffled = productsData.sort(() => 0.5 - Math.random());
      setTopOffers(shuffled.slice(0, 5)); 
      setSuperDiscounts(shuffled.slice(5, 15)); 
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOffers();
  };

  const goToFullCart = () => {
    setMiniCartVisible(false);
    setIsLoadingCart(true);
    setTimeout(() => {
      setIsLoadingCart(false);
      router.push("/cart");
    }, 1500);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#83c41a" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={styles.backCircle}>
            <Ionicons name="chevron-back" size={24} color="#555" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ofertas</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BOTTOM_TAB_HEIGHT + 120 }} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#83c41a']} />
        }
      >
        
        <View style={styles.carouselSection}>
          <FlatList
            data={topOffers}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 10, paddingTop: 15 }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
               const cartItem = cart.find((c) => c.id === item.id);
               const currentQty = cartItem ? cartItem.quantity : 0;

               return (
                 <TopOfferItem 
                    item={item} 
                    currentQty={currentQty}
                    addToCart={addToCart} 
                    decreaseCart={decreaseCart}
                    removeFromCart={removeFromCart}
                 />
               );
            }}
          />
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Busca por categoría</Text>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 20 }}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <View style={styles.catItem}>
                <View style={styles.catCircle}>
                  <Image source={item.icon} style={styles.catImage} />
                </View>
                <Text style={styles.catText}>{item.name}</Text>
              </View>
            )}
          />
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Super descuentos</Text>
          
          {superDiscounts.map((item) => {
             const cartItem = cart.find((c) => c.id === item.id);
             const currentQty = cartItem ? cartItem.quantity : 0;

             return (
               <SuperDiscountItem 
                  key={item.id} 
                  item={item} 
                  currentQty={currentQty}
                  addToCart={addToCart}
                  decreaseCart={decreaseCart}
                  removeFromCart={removeFromCart}
               />
             );
          })}
        </View>

      </ScrollView>

      <View style={styles.chatbotContainer}>
        <OpenChatbotButton />
      </View>

      <TouchableOpacity 
        style={styles.floatingCartBtn} 
        onPress={() => setMiniCartVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="basket-outline" size={28} color="#333" />
        {totalItems > 0 && (
          <View style={styles.floatingBadge}>
             <Text style={styles.badgeText}>{totalItems}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={miniCartVisible} transparent animationType="slide" onRequestClose={() => setMiniCartVisible(false)}>
         <TouchableOpacity style={styles.miniCartOverlay} activeOpacity={1} onPress={() => setMiniCartVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.miniCartContent}>
               
               <View style={styles.miniHeader}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                     <TouchableOpacity onPress={() => setMiniCartVisible(false)}>
                        <Ionicons name="chevron-back-circle" size={30} color="#888" />
                     </TouchableOpacity>
                     <Text style={styles.miniTitle}>Tu compra</Text>
                  </View>
                  
                  <TouchableOpacity 
                     disabled={!isMinMet}
                     style={[styles.miniGoCartBtn, !isMinMet ? styles.btnDisabled : styles.btnActive]}
                     onPress={goToFullCart}
                  >
                     <Text style={styles.miniGoCartText}>Ir al carrito</Text>
                  </TouchableOpacity>
               </View>

               <View style={styles.miniListContainer}>
                  {cart.length === 0 ? (
                     <Text style={styles.emptyText}>El carrito está vacío.</Text>
                  ) : (
                     <FlatList 
                        data={cart}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({item}) => (
                           <View style={styles.miniItemRow}>
                              <Image source={{ uri: item.imageUrl }} style={styles.miniItemImg} />
                              <View style={{flex:1, marginLeft:10}}>
                                 <Text style={styles.miniItemName} numberOfLines={1}>{item.name}</Text>
                                 <Text style={styles.miniItemPrice}>${item.price.toLocaleString()}</Text>
                              </View>
                              
                              <View style={styles.miniControls}>
                                 <TouchableOpacity 
                                    onPress={() => item.quantity > 1 ? decreaseCart(item.id) : removeFromCart(item.id)}
                                    style={[styles.miniCtrlBtn, item.quantity === 1 ? {backgroundColor:'#FFEBEE', borderColor:'#FFCDD2'} : {backgroundColor:'#EEE'}]}
                                 >
                                    <Ionicons 
                                       name={item.quantity === 1 ? "trash-outline" : "remove"} 
                                       size={16} 
                                       color={item.quantity === 1 ? "#D32F2F" : "#555"} 
                                    />
                                 </TouchableOpacity>
                                 <Text style={styles.miniCtrlText}>{item.quantity}</Text>
                                 <TouchableOpacity onPress={() => addToCart({...item, quantity: 1})} style={[styles.miniCtrlBtn, {backgroundColor:'#4CAF50', borderColor:'#4CAF50'}]}>
                                    <Ionicons name="add" size={16} color="#FFF" />
                                 </TouchableOpacity>
                              </View>
                           </View>
                        )}
                     />
                  )}
               </View>

               <View>
                  <View style={[styles.minOrderBanner, isMinMet ? {backgroundColor:'#B9F6CA'} : {backgroundColor:'#FFE0B2'}]}>
                     <Ionicons 
                        name={isMinMet ? "checkmark-circle-outline" : "alert-circle-outline"} 
                        size={18} 
                        color={isMinMet ? "#00C853" : "#EF6C00"} 
                     />
                     <Text style={[styles.minOrderText, {color: isMinMet ? '#00C853' : '#EF6C00'}]}>
                        {isMinMet ? "Mínimo de compra completado" : `Mínimo de compra: $${MIN_ORDER_AMOUNT.toLocaleString()}`}
                     </Text>
                  </View>

                  <View style={styles.miniTotalRow}>
                     <Text style={styles.totalLabel}>Total</Text>
                     <Text style={styles.totalValue}>${totalPrice.toLocaleString()}</Text>
                  </View>
               </View>

            </TouchableOpacity>
         </TouchableOpacity>
      </Modal>

      <Modal visible={isLoadingCart} transparent animationType="fade">
         <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
               <ActivityIndicator size="large" color="#83c41a" />
               <Text style={{marginTop:10, fontWeight:'bold', color:'#555'}}>Cargando carrito...</Text>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const TopOfferItem = ({ item, currentQty, addToCart, decreaseCart, removeFromCart }: any) => {
  
  const handleDecrease = () => {
    if (currentQty > 1) decreaseCart(item.id);
    else removeFromCart(item.id);
  };

  return (
    <View style={styles.offerCard}>
      <View style={styles.yellowBadge}>
        <Text style={styles.yellowBadgeText}>{item.discountTag}</Text>
      </View>

      <Image source={{ uri: item.imageUrl }} style={styles.offerImage} />
      
      <View style={{paddingHorizontal: 5, width: '100%'}}>
        <Text style={styles.priceText}>${item.price.toLocaleString()}</Text>
        {item.oldPrice && (
            <Text style={styles.oldPriceText}>Antes ${item.oldPrice.toLocaleString()}</Text>
        )}
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      </View>

      <View style={styles.actionsContainer}>
        {currentQty === 0 ? (
            <TouchableOpacity 
               style={styles.addBtnFloating}
               onPress={() => addToCart({ ...item, quantity: 1 })}
            >
               <Ionicons name="cart-outline" size={20} color="#FFF" />
            </TouchableOpacity>
        ) : (
            <View style={styles.qtyPill}>
                <TouchableOpacity onPress={handleDecrease} style={styles.qtyBtnSmall}>
                    <Ionicons name={currentQty === 1 ? "trash-outline" : "remove"} size={14} color="#D32F2F" />
                </TouchableOpacity>
                <Text style={styles.qtyTextSmall}>{currentQty}</Text>
                <TouchableOpacity onPress={() => addToCart({ ...item, quantity: 1 })} style={styles.qtyBtnSmall}>
                    <Ionicons name="add" size={14} color="#4CAF50" />
                </TouchableOpacity>
            </View>
        )}
      </View>
    </View>
  );
};

const SuperDiscountItem = ({ item, currentQty, addToCart, decreaseCart, removeFromCart }: any) => {
  
  const handleDecrease = () => {
    if (currentQty > 1) decreaseCart(item.id);
    else removeFromCart(item.id);
  };

  return (
    <View style={styles.superCard}>
      
      <View style={styles.imageWrapper}>
         <Image source={{ uri: item.imageUrl }} style={styles.superImage} />
         <View style={styles.discountCircle}>
            <Text style={styles.discountCircleText}>{item.discountTag}</Text>
         </View>
      </View>

      <View style={styles.superInfo}>
        <Text style={styles.superName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.superPrice}>${item.price.toLocaleString()}</Text>
          {item.oldPrice && (
            <Text style={styles.superOldPrice}>${item.oldPrice.toLocaleString()}</Text>
          )}
        </View>
      </View>

      <View style={styles.superActions}>
         {currentQty === 0 ? (
            <TouchableOpacity style={styles.addBtnSquare} onPress={() => addToCart({ ...item, quantity: 1 })}>
               <Ionicons name="cart-outline" size={22} color="#FFF" />
            </TouchableOpacity>
         ) : (
            <View style={styles.qtyVertical}>
               <TouchableOpacity onPress={() => addToCart({ ...item, quantity: 1 })} style={styles.qtyBtnVert}>
                  <Ionicons name="add" size={14} color="#FFF" />
               </TouchableOpacity>
               <Text style={styles.qtyTextVert}>{currentQty}</Text>
               <TouchableOpacity onPress={handleDecrease} style={[styles.qtyBtnVert, {backgroundColor:'#FFEBEE'}]}>
                  <Ionicons name={currentQty === 1 ? "trash-outline" : "remove"} size={14} color="#D32F2F" />
               </TouchableOpacity>
            </View>
         )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  loadingContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FAFAFA',
  },
  backButton: { marginRight: 15 },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  carouselSection: { marginTop: 10, marginBottom: 20 },
  offerCard: {
    width: width * 0.42,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 10,
    marginRight: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
    alignItems: 'center',
    position: 'relative'
  },
  yellowBadge: {
    position: 'absolute',
    top: 10, left: 10,
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
  },
  yellowBadgeText: { fontSize: 11, fontWeight: '800', color: '#E65100' },
  offerImage: {
    width: '80%', height: 90,
    resizeMode: 'contain',
    marginTop: 15, marginBottom: 10,
  },
  priceText: { fontSize: 17, fontWeight: 'bold', color: '#000' },
  oldPriceText: { fontSize: 11, color: '#999', textDecorationLine: 'line-through', marginBottom: 4 },
  productName: { fontSize: 13, color: '#444', marginBottom: 15, height: 34, textAlign: 'center' },
  
  actionsContainer: { width: '100%', alignItems: 'center', height: 40, justifyContent: 'center' },
  addBtnFloating: {
    backgroundColor: '#00E600',
    width: 40, height: 40,
    borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: "#00E600", shadowOpacity: 0.4, shadowOffset:{width:0, height:3}, elevation: 3
  },
  qtyPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 25,
    paddingHorizontal: 5, height: 38,
    width: '100%', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#EEE'
  },
  qtyBtnSmall: { padding: 8 },
  qtyTextSmall: { fontWeight: 'bold', color: '#333', fontSize: 16 },

  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 15, paddingHorizontal: 20 },
  catItem: { alignItems: 'center', marginRight: 20 },
  catCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE',
    justifyContent: 'center', alignItems: 'center', marginBottom: 5,
  },
  catImage: { width: 35, height: 35, resizeMode: 'contain' },
  catText: { fontSize: 11, color: '#555', fontWeight: '500' },

  superCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 20, marginBottom: 15,
    borderRadius: 20,
    padding: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    alignItems: 'center',
  },
  imageWrapper: { position: 'relative', marginRight: 15 },
  superImage: { width: 70, height: 70, resizeMode: 'contain' },
  discountCircle: {
    position: 'absolute', top: -5, left: -5,
    backgroundColor: '#D32F2F', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 2
  },
  discountCircleText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  
  superInfo: { flex: 1 },
  superName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  superPrice: { fontSize: 16, fontWeight: 'bold', color: '#000', marginRight: 8 },
  superOldPrice: { fontSize: 12, color: '#999', textDecorationLine: 'line-through' },

  superActions: { marginLeft: 10 },
  addBtnSquare: {
    backgroundColor: '#83c41a',
    width: 44, height: 44,
    borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2
  },
  qtyVertical: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1, borderColor: '#EEE'
  },
  qtyBtnVert: {
    width: 32, height: 28,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#83c41a',
    borderRadius: 8,
    marginVertical: 2
  },
  qtyTextVert: { fontSize: 14, fontWeight: 'bold', marginVertical: 2 },

  chatbotContainer: { position: "absolute", bottom: BOTTOM_TAB_HEIGHT + 10, right: 20, zIndex: 999 },
  floatingCartBtn: {
    position: "absolute",
    bottom: BOTTOM_TAB_HEIGHT + 80, 
    right: 20,
    backgroundColor: "#FFF",
    width: 60, height: 60,
    borderRadius: 30,
    justifyContent: "center", alignItems: "center",
    elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 5,
    zIndex: 1000, 
    borderWidth: 1, borderColor: '#FAFAFA'
  },
  floatingBadge: { position: "absolute", top: -2, right: -2, backgroundColor: '#00E600', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  miniCartOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  miniCartContent: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 25, borderTopRightRadius: 25, 
    padding: 20, paddingBottom: 30,
    maxHeight: height * 0.7, 
    shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20
  },
  miniHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  miniTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 10, color: '#333' },
  miniGoCartBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, elevation: 2 },
  btnActive: { backgroundColor: '#00E600' },
  btnDisabled: { backgroundColor: '#DDD' },
  miniGoCartText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  miniListContainer: { maxHeight: height * 0.4, marginBottom: 20 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  miniItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingBottom: 10 },
  miniItemImg: { width: 50, height: 50, resizeMode: 'contain', marginRight: 5 },
  miniItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  miniItemPrice: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  miniControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 15, padding: 2, borderWidth: 1, borderColor: '#EEE' },
  miniCtrlBtn: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DDD' },
  miniCtrlText: { marginHorizontal: 10, fontWeight: 'bold', fontSize: 14 },
  minOrderBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, marginBottom: 15 },
  minOrderText: { marginLeft: 8, fontSize: 12, fontWeight: '600' },
  miniTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingCard: { backgroundColor: '#FFF', padding: 25, borderRadius: 20, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
});
