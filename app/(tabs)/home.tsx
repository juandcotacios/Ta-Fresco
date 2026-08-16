import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useState, useMemo } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  quantity?: number;
}

const CATEGORIES = [
  { name: "Verduras", icon: require("../assets/categorias/verduras.png") },
  { name: "Frutas", icon: require("../assets/categorias/frutas.png") },
  { name: "Tubérculos", icon: require("../assets/categorias/tuberculos.png") },
  { name: "Hortalizas", icon: require("../assets/categorias/hortalizas.png") },
  { name: "Abarrotes", icon: require("../assets/categorias/abarrotes.png") },
];

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  
  const [miniCartVisible, setMiniCartVisible] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  const { cart, addToCart, decreaseCart, removeFromCart } = useCart();

  const totalPrice = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const isMinMet = totalPrice >= MIN_ORDER_AMOUNT;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snapshot = await getDocs(collection(db, "Productos"));
        const data = snapshot.docs.map((doc) => {
          const productData = doc.data() as any;
          return {
            id: doc.id,
            name: productData.name || "Sin nombre",
            price: productData.price || 0,
            imageUrl: productData.imageUrl || "https://via.placeholder.com/300",
            category: (productData.category || "sin categoria").toString(),
            stock: productData.stock || 0,
          } as Product;
        });
        setProducts(data);
      } catch (e) {
        console.log(e);
      }
    };
    fetchProducts();
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedProducts = CATEGORIES.map((cat) => ({
    category: cat.name,
    products: filtered.filter((p) => {
      const catName = cat.name.toLowerCase().replace(/s$/, "");
      const prodCat = (p.category || "").toLowerCase();
      return prodCat.includes(catName) || prodCat === cat.name.toLowerCase();
    }),
  }));

  const goToFullCart = () => {
    setMiniCartVisible(false);
    setIsLoadingCart(true);
    setTimeout(() => {
      setIsLoadingCart(false);
      router.push("/cart");
    }, 1500);
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BOTTOM_TAB_HEIGHT + 120 }} 
      >
        <View style={styles.headerContainer}>
          <Image
            source={require("../assets/images/logo44.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            placeholder="Buscar"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 4 }}
            renderItem={({ item }) => (
              <View style={styles.categoryItem}>
                <View style={styles.categoryCircle}>
                  <Image source={item.icon} style={styles.categoryImage} resizeMode="contain" />
                </View>
                <Text style={styles.categoryLabel}>{item.name}</Text>
              </View>
            )}
            keyExtractor={(item) => item.name}
          />
        </View>

        <View style={styles.promoWrapper}>
          <View style={styles.promoBackground}>
            <View style={styles.promoLeftContent}>
              <Text style={styles.promoPercent}>30%</Text>
              <Text style={styles.promoSubtitle}>Descuento</Text>
              <Text style={styles.promoDate}>Hasta el 25/08</Text>
              <View style={styles.priceTagContainer}>
                 <View style={styles.nowBadge}><Text style={styles.nowBadgeText}>Ahora</Text></View>
                 <Text style={styles.promoPrice}>$3,724</Text>
              </View>
            </View>
            <View style={styles.promoImageContainer}>
              <Image source={{ uri: "https://www.buyfrescapp.com/wp-content/uploads/2025/11/BOG-CAT001-00005-3-300x300.png" }} style={styles.promoImage} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.promoProductLabel}>Pimentón Maduración Mixta</Text>
        </View>

        {groupedProducts.map((group) =>
            group.products.length > 0 && (
              <View key={group.category} style={styles.productSection}>
                <Text style={styles.sectionTitle}>{group.category}</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={group.products}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingLeft: 5, paddingBottom: 15 }}
                  renderItem={({ item }) => {
                    const cartItem = cart.find((c) => c.id === item.id);
                    const currentQty = cartItem ? cartItem.quantity : 0;
                    return (
                      <ProductCard
                        item={item}
                        categoryLabel={group.category}
                        currentQty={currentQty}
                        onAdd={() => addToCart({ ...item, quantity: 1 })}
                        onRemove={() => decreaseCart(item.id)}
                        onDelete={() => removeFromCart(item.id)}
                      />
                    );
                  }}
                />
              </View>
            )
        )}
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
                              <Image source={{ uri: item.imageUrl }} style={styles.miniItemImg} resizeMode="contain" />
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

function ProductCard({ item, categoryLabel, currentQty, onAdd, onRemove, onDelete }: any) {
  const handleDecrease = () => {
    if (currentQty > 1) onRemove(); else onDelete();
  };

  return (
    <View style={styles.productCard}>
      <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="contain" />
      <View style={styles.productInfo}>
        <Text style={styles.productPrice}>$ {item.price.toLocaleString()}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productUnitLabel}>{categoryLabel} - kg</Text>
      </View>
      <View style={styles.actionsRow}>
        {currentQty === 0 ? (
          <TouchableOpacity style={styles.addToCartFullBtn} onPress={onAdd}>
             <Ionicons name="cart-outline" size={20} color="#FFF" style={{marginRight:5}} />
             <Text style={{color:'#FFF', fontWeight:'bold'}}>Agregar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.qtyPill}>
             <TouchableOpacity onPress={handleDecrease} style={styles.qtyBtn}>
                <Ionicons name={currentQty === 1 ? "trash-outline" : "remove"} size={16} color="#D32F2F" />
             </TouchableOpacity>
             <Text style={styles.qtyText}>{currentQty}</Text>
             <TouchableOpacity onPress={onAdd} style={styles.qtyBtn}>
                <Ionicons name="add" size={16} color="#4CAF50" />
             </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FAFAFA" },
  scrollContainer: { flex: 1, paddingHorizontal: 16 },

  headerContainer: { marginTop: height * 0.05, marginBottom: 15, alignItems: "flex-start", paddingLeft: 4, width: '100%' },
  logo: { width: 140, height: 40 },

  searchContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
    borderWidth: 1, borderColor: "#F1F1F1", elevation: 1,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#000" },

  categoriesSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 19, fontWeight: "bold", color: "#111", marginBottom: 15, paddingLeft: 4 },
  categoryItem: { alignItems: "center", marginRight: 18, width: width * 0.18 },
  categoryCircle: {
    width: width * 0.16, height: width * 0.16, borderRadius: (width * 0.16) / 2, backgroundColor: "#FFF",
    justifyContent: "center", alignItems: "center", marginBottom: 8,
    borderWidth: 1, borderColor: "#F0F0F0", elevation: 2,
  },
  categoryImage: { width: '60%', height: '60%' },
  categoryLabel: { fontSize: 11, color: "#444", textAlign: "center", fontWeight: '500' },

  promoWrapper: { marginBottom: 25, height: 170, position: "relative", marginTop: 10 },
  promoBackground: {
    backgroundColor: "#FF6F00", borderRadius: 22, height: "100%", width: "100%",
    flexDirection: 'row', padding: 20, position: 'relative', overflow: 'hidden',
  },
  promoLeftContent: { width: "55%", justifyContent: 'center', zIndex: 2 },
  promoPercent: { fontSize: 38, fontWeight: "900", color: "#FFF", lineHeight: 38 },
  promoSubtitle: { fontSize: 20, fontWeight: "700", color: "#FFF", marginBottom: 4 },
  promoDate: { fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 12 },
  priceTagContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start',
  },
  nowBadge: { backgroundColor: "#FFEB3B", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  nowBadgeText: { color: "#D84315", fontWeight: "800", fontSize: 10 },
  promoPrice: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  promoImageContainer: { position: 'absolute', right: -25, top: -20, bottom: 0, justifyContent: 'center', alignItems: 'center', width: '60%', height: '120%' },
  promoImage: { width: 200, height: 200 },
  promoProductLabel: { position: 'absolute', bottom: 15, right: 15, fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600', zIndex: 3 },

  productSection: { marginBottom: 25 },
  productCard: {
    backgroundColor: "#FFF", width: 165, borderRadius: 18, padding: 12, marginRight: 15,
    elevation: 3, marginBottom: 10, alignItems: "center",
  },
  productImage: { width: 110, height: 110, marginBottom: 12 },
  productInfo: { width: '100%', paddingHorizontal: 2, marginBottom: 10 },
  productPrice: { fontSize: 17, fontWeight: "bold", color: "#222" },
  productName: { fontSize: 13, color: "#555", marginTop: 2, height: 34 },
  productUnitLabel: { fontSize: 11, color: "#999", marginTop: 4 },
  actionsRow: { flexDirection: 'row', width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 5, height: 40 },
  addToCartFullBtn: {
    flexDirection: 'row', backgroundColor: '#4CAF50', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', width: '100%'
  },
  qtyPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 20, height: 38, paddingHorizontal: 6, borderWidth: 1, borderColor: '#EEE',
    width: '100%', justifyContent: 'space-between'
  },
  qtyBtn: { padding: 5, width: 30, alignItems: 'center' },
  qtyText: { fontSize: 16, fontWeight: '700', color: '#333' },

  chatbotContainer: {
    position: "absolute",
    bottom: BOTTOM_TAB_HEIGHT + 10, 
    right: 20,
    zIndex: 999,
  },

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
  miniItemImg: { width: 50, height: 50, marginRight: 5 },
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