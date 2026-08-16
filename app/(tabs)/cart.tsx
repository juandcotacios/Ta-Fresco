import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";
import { collection, getDocs, limit, query } from "firebase/firestore"; 
import { getAuth } from "firebase/auth"; 
import { db } from "@/src/config/firebase"; 
import { useCart } from "@/src/contexts/CartContext"; 
import { crearPedido } from "@/src/services/pedidosService";
import OpenChatbotButton from "../../components/OpenChatbotButton"; 

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const MIN_ORDER_AMOUNT = 100000; 
const auth = getAuth();

interface CartItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  quantity: number; 
  stock?: number;
}

export default function CartScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const { cart, addToCart, removeFromCart, clearCart, decreaseCart } = useCart(); 
  
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardDate, setCardDate] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  
  const [upsellProducts, setUpsellProducts] = useState<any[]>([]);
  const [loadingUpsell, setLoadingUpsell] = useState(true);
  const [clearModalVisible, setClearModalVisible] = useState(false);

  const totalPrice = useMemo(() => {
    return cart.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const isMinMet = totalPrice >= MIN_ORDER_AMOUNT;

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        setLoadingAddresses(false);
        return;
      }
      try {
        const q = collection(db, `users/${user.uid}/addresses`);
        const snapshot = await getDocs(q);
        const addressList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setAddresses(addressList);
        if (addressList.length > 0) {
          setSelectedAddress(addressList[0].id);
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoadingAddresses(false);
      }
    };
    fetchAddresses();
  }, [user]);

  useEffect(() => {
    const fetchUpsellProducts = async () => {
      try {
        const q = query(collection(db, "Productos"), limit(5));
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Producto",
            price: data.price || 0,
            oldPrice: Math.floor((data.price || 0) * 1.15), 
            discount: "-15%",
            imageUrl: data.imageUrl || "https://via.placeholder.com/100",
            category: data.category || "Varios",
            stock: data.stock || 99
          };
        });
        const cartIds = cart.map((c: any) => c.id);
        const filtered = products.filter(p => !cartIds.includes(p.id));
        setUpsellProducts(filtered);
      } catch (error) { console.log(error); } 
      finally { setLoadingUpsell(false); }
    };
    fetchUpsellProducts();
  }, [cart]);

  const handleIncrease = (item: any) => {
    addToCart({ ...item, quantity: 1 });
  };

  const handleDecrease = (item: any) => {
    if (item.quantity > 1) {
      if (decreaseCart) decreaseCart(item.id);
      else addToCart({ ...item, quantity: -1 }); 
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeFromCart(item.id);
    }
  };

  const handleCardNumberChange = (text: string) => setCardNumber(text.replace(/[^0-9]/g, ''));
  const handleCVCChange = (text: string) => setCardCVC(text.replace(/[^0-9]/g, ''));
  const handleDateChange = (text: string) => {
    let clean = text.replace(/[^0-9]/g, '');
    if (clean.length >= 2) {
       const month = parseInt(clean.substring(0, 2));
       if (month > 12) clean = '12' + clean.substring(2);
       if (month === 0) clean = '01' + clean.substring(2);
    }
    if (clean.length > 2) {
       clean = clean.substring(0, 2) + '/' + clean.substring(2, 4);
    }
    setCardDate(clean);
  };

  const handlePay = async () => {
    if (paymentMethod === 'card') {
        if (cardNumber.length < 13 || cardDate.length < 5 || cardCVC.length < 3) {
            Alert.alert("Error", "Verifica los datos de la tarjeta");
            return;
        }
    }
    if (!selectedAddress && addresses.length > 0) {
       Alert.alert("Error", "Selecciona una dirección de entrega");
       return;
    }
    if (!user) {
       Alert.alert("Error", "Debes iniciar sesión para confirmar el pedido.");
       return;
    }

    setProcessingPayment(true);
    try {
        await crearPedido(user.uid, cart, totalPrice, 3500);
        setProcessingPayment(false);
        setCheckoutVisible(false);
        setSuccessVisible(true);
        setTimeout(() => {
            clearCart();
            setSuccessVisible(false);
            router.replace("/home"); 
        }, 2500);
    } catch (error: any) {
        console.log("Error creando pedido:", error);
        setProcessingPayment(false);
        Alert.alert("Error", error?.message || "No se pudo confirmar el pedido. Intenta de nuevo.");
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Tu pedido" onBack={() => router.back()} />
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
               <Ionicons name="cart-outline" size={80} color="#DDD" />
            </View>
            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
            <Text style={styles.emptySubtitle}>Agrega productos frescos para comenzar</Text>
            
            <TouchableOpacity style={styles.goToStoreBtn} onPress={() => router.push("/home")}>
              <Text style={styles.goToStoreText}>Ir a comprar</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Tu pedido" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 250 }} showsVerticalScrollIndicator={false}>
        {!isMinMet ? (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#F57C00" />
            <Text style={styles.warningText}>Faltan ${(MIN_ORDER_AMOUNT - totalPrice).toLocaleString()} para el mínimo.</Text>
          </View>
        ) : (
          <View style={styles.successBanner}>
             <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
             <Text style={styles.successText}>¡Pedido mínimo alcanzado!</Text>
          </View>
        )}

        <View style={styles.listContainer}>
          {cart.map((item: any) => (
            <CartItemRow 
              key={item.id} 
              item={item} 
              onIncrease={() => handleIncrease(item)}
              onDecrease={() => handleDecrease(item)}
            />
          ))}
        </View>

        <TouchableOpacity onPress={() => setClearModalVisible(true)} style={styles.cleanBtn}>
          <Ionicons name="trash-outline" size={16} color="#D32F2F" />
          <Text style={styles.clearCartText}>Vaciar carrito</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.upsellSection}>
            <Text style={styles.upsellTitle}>Productos que te podrían gustar</Text>
            {loadingUpsell ? <ActivityIndicator color="#83c41a" /> : (
              <FlatList 
                data={upsellProducts}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <UpsellCard item={item} onAdd={() => addToCart({...item, quantity: 1})} />
                )}
              />
            )}
        </View>
      </ScrollView>

      <View style={styles.chatbotContainer}>
        <OpenChatbotButton />
      </View>

      <View style={styles.footerCard}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total a pagar</Text>
          <Text style={styles.totalAmount}>${totalPrice.toLocaleString()}</Text>
        </View>
        <TouchableOpacity 
          disabled={!isMinMet}
          style={[styles.payButton, !isMinMet ? styles.payButtonDisabled : styles.payButtonActive]}
          onPress={() => setCheckoutVisible(true)}
        >
          <Text style={styles.payButtonText}>Ir a Pagar</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" style={{marginLeft: 5}}/>
        </TouchableOpacity>
      </View>

      <Modal visible={checkoutVisible} animationType="slide" presentationStyle="pageSheet">
         <View style={styles.checkoutContainer}>
            <View style={styles.checkoutHeader}>
                <Text style={styles.checkoutTitle}>Finalizar Pedido</Text>
                <TouchableOpacity onPress={() => setCheckoutVisible(false)}>
                   <Ionicons name="close-circle" size={30} color="#888" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 50}}>
                <Text style={styles.sectionHeader}>¿Dónde lo enviamos?</Text>
                
                {loadingAddresses ? (
                   <ActivityIndicator color="#83c41a" style={{marginBottom: 20}}/>
                ) : addresses.length === 0 ? (
                   <View style={styles.noAddressBox}>
                      <Text style={{color:'#666', marginBottom: 10}}>No tienes direcciones guardadas.</Text>
                      <TouchableOpacity onPress={() => {setCheckoutVisible(false); router.push("/profile")}} style={styles.addAddressBtnSmall}>
                         <Text style={{color:'#FFF', fontWeight:'bold'}}>Ir a Perfil a crear una</Text>
                      </TouchableOpacity>
                   </View>
                ) : (
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                      {addresses.map((addr) => (
                         <TouchableOpacity 
                           key={addr.id} 
                           style={[styles.addressCard, selectedAddress === addr.id && styles.addressCardSelected]}
                           onPress={() => setSelectedAddress(addr.id)}
                         >
                            <Ionicons name={selectedAddress === addr.id ? "radio-button-on" : "radio-button-off"} size={20} color={selectedAddress === addr.id ? "#83c41a" : "#888"} />
                            <View style={{marginLeft: 10, flex: 1}}>
                               <Text style={styles.addrAlias} numberOfLines={1}>{addr.name}</Text>
                               <Text style={styles.addrText} numberOfLines={2}>{addr.addressLine}</Text>
                            </View>
                         </TouchableOpacity>
                      ))}
                   </ScrollView>
                )}

                <Text style={styles.sectionHeader}>Método de Pago</Text>
                <View style={styles.paymentMethods}>
                   <TouchableOpacity 
                      style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
                      onPress={() => setPaymentMethod('cash')}
                   >
                      <Ionicons name="cash-outline" size={24} color="#333" />
                      <Text style={styles.paymentText}>Contraentrega</Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                      style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
                      onPress={() => setPaymentMethod('card')}
                   >
                      <Ionicons name="card-outline" size={24} color="#333" />
                      <Text style={styles.paymentText}>Tarjeta</Text>
                   </TouchableOpacity>
                </View>

                {paymentMethod === 'card' && (
                    <View style={styles.cardForm}>
                        <Text style={styles.label}>Número de Tarjeta</Text>
                        <TextInput 
                           placeholder="0000 0000 0000 0000" 
                           style={styles.input} keyboardType="numeric" maxLength={16}
                           value={cardNumber} onChangeText={handleCardNumberChange}
                        />
                         <Text style={styles.label}>Nombre del titular</Text>
                         <TextInput placeholder="Como aparece en la tarjeta" style={styles.input} value={cardName} onChangeText={setCardName}/>
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                           <View style={{width: '48%'}}>
                              <Text style={styles.label}>Fecha (MM/YY)</Text>
                              <TextInput placeholder="MM/YY" style={styles.input} maxLength={5} keyboardType="numeric" value={cardDate} onChangeText={handleDateChange}/>
                           </View>
                           <View style={{width: '48%'}}>
                              <Text style={styles.label}>CVC</Text>
                              <TextInput placeholder="123" style={styles.input} maxLength={3} keyboardType="numeric" value={cardCVC} onChangeText={handleCVCChange}/>
                           </View>
                        </View>
                    </View>
                )}

                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>${totalPrice.toLocaleString()}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Envío</Text><Text style={styles.summaryValue}>$3,500</Text></View>
                    <View style={[styles.summaryRow, {marginTop: 10, borderTopWidth:1, borderColor:'#EEE', paddingTop:10}]}>
                        <Text style={styles.totalBigLabel}>Total</Text><Text style={styles.totalBigValue}>${(totalPrice + 3500).toLocaleString()}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.checkoutFooter}>
                <TouchableOpacity style={styles.confirmButton} onPress={handlePay} disabled={processingPayment}>
                    {processingPayment ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>Confirmar Pedido</Text>}
                </TouchableOpacity>
            </View>
         </View>
      </Modal>

      <Modal visible={successVisible} transparent animationType="fade">
          <View style={styles.successOverlay}>
             <View style={styles.successCard}>
                <Ionicons name="checkmark-circle" size={80} color="#83c41a" />
                <Text style={styles.successTitle}>¡Pedido Realizado!</Text>
                <Text style={styles.successSub}>Tu pedido llegará pronto.</Text>
             </View>
          </View>
      </Modal>

      <CustomModal visible={clearModalVisible} onClose={() => setClearModalVisible(false)} onConfirm={() => { clearCart(); setClearModalVisible(false); }} />
    </View>
  );
}

const Header = ({ title, onBack }: any) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.backCircle}><Ionicons name="chevron-back" size={24} color="#555" /></TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const CartItemRow = ({ item, onIncrease, onDecrease }: any) => (
  <View style={styles.cartItem}>
    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
    <View style={styles.itemInfo}>
      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.itemCategory}>{item.category}</Text>
      <Text style={styles.itemPrice}>${item.price.toLocaleString()}</Text>
    </View>
    <View style={styles.qtyContainer}>
      <TouchableOpacity style={[styles.qtyBtn, item.quantity === 1 ? styles.qtyBtnRed : styles.qtyBtnGray]} onPress={onDecrease}>
        <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={item.quantity === 1 ? "#FFF" : "#555"} />
      </TouchableOpacity>
      <Text style={styles.qtyText}>{item.quantity}</Text>
      <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnGreen]} onPress={onIncrease}><Ionicons name="add" size={16} color="#FFF" /></TouchableOpacity>
    </View>
  </View>
);

const UpsellCard = ({ item, onAdd }: any) => (
  <View style={styles.upsellCard}>
     {item.discount && <View style={styles.yellowBadge}><Text style={styles.badgeText}>{item.discount}</Text></View>}
     <TouchableOpacity style={styles.addFloating} onPress={onAdd}><Ionicons name="add" size={20} color="#FFF" /></TouchableOpacity>
     <View style={styles.imageContainer}><Image source={{ uri: item.imageUrl }} style={styles.upsellImage} /></View>
     <View style={{paddingHorizontal: 5}}> 
        <Text style={styles.upsellPrice}>${item.price.toLocaleString()}</Text>
        {item.oldPrice && <Text style={styles.upsellOldPrice}>${item.oldPrice.toLocaleString()}</Text>}
        <Text style={styles.upsellName} numberOfLines={2}>{item.name}</Text>
     </View>
  </View>
);

const CustomModal = ({ visible, onClose, onConfirm }: any) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>¿Vaciar carrito?</Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.btnCancel} onPress={onClose}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnConfirm} onPress={onConfirm}><Text style={styles.btnConfirmText}>Sí, vaciar</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: height * 0.15 },
  emptyIconContainer: { backgroundColor: '#F0F0F0', padding: 30, borderRadius: 100, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 30 },
  goToStoreBtn: { backgroundColor: '#83c41a', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30, shadowColor: "#83c41a", shadowOpacity: 0.3, shadowOffset: {width:0, height:5} },
  goToStoreText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  warningBanner: { backgroundColor: '#FFF3E0', padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  warningText: { color: '#EF6C00', marginLeft: 8, fontSize: 13, fontWeight: '500' },
  successBanner: { backgroundColor: '#E8F5E9', padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  successText: { color: '#2E7D32', marginLeft: 8, fontSize: 13, fontWeight: 'bold' },
  listContainer: { padding: 20, backgroundColor: '#FFF', marginTop: 10, borderRadius: 20, marginHorizontal: 15 },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F9F9F9', paddingBottom: 15 },
  itemImage: { width: 65, height: 65, resizeMode: 'contain', marginRight: 15, backgroundColor:'#F9F9F9', borderRadius: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  itemCategory: { fontSize: 12, color: '#999', marginBottom: 5 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, padding: 4 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  qtyBtnRed: { backgroundColor: '#FFEBEE' },
  qtyBtnGreen: { backgroundColor: '#83c41a' },
  qtyBtnGray: { backgroundColor: '#E0E0E0' },
  qtyText: { marginHorizontal: 12, fontWeight: 'bold', fontSize: 15 },
  cleanBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  clearCartText: { color: '#D32F2F', fontSize: 13, fontWeight: '600', marginLeft: 5 },
  divider: { height: 10 },
  upsellSection: { marginTop: 10, paddingLeft: 20 },
  upsellTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  upsellCard: { width: width * 0.4, backgroundColor: '#FFF', borderRadius: 16, padding: 10, marginRight: 15, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2}, marginBottom: 10 },
  imageContainer: { width: '100%', height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  upsellImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  yellowBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#FFF100', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  addFloating: { position: 'absolute', top: 5, right: 5, backgroundColor: '#83c41a', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', zIndex: 2, elevation: 3 },
  upsellPrice: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  upsellOldPrice: { fontSize: 11, color: '#999', textDecorationLine: 'line-through' },
  upsellName: { fontSize: 12, color: '#666', marginTop: 2, height: 32 },
  footerCard: { position: 'absolute', bottom: 80, left: 20, right: 20, backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 },
  totalSection: { flexDirection: 'column' },
  totalLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  payButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  payButtonActive: { backgroundColor: '#83c41a', shadowColor: "#83c41a", shadowOpacity: 0.4, shadowOffset: {width:0, height:4} },
  payButtonDisabled: { backgroundColor: '#E0E0E0' },
  payButtonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  chatbotContainer: { position: "absolute", bottom: 160, right: 20, zIndex: 999 },
  checkoutContainer: { flex: 1, backgroundColor: '#F9F9F9' },
  checkoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
  checkoutTitle: { fontSize: 20, fontWeight: 'bold' },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 15, color: '#333' },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '600', marginTop: 10 },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#EEE', width: width * 0.6 },
  addressCardSelected: { borderColor: '#83c41a', backgroundColor: '#F4F9EB' },
  addrAlias: { fontWeight: 'bold', fontSize: 14 },
  addrText: { fontSize: 12, color: '#666' },
  addAddressBtnSmall: { marginTop: 10, backgroundColor: '#83c41a', padding: 10, borderRadius: 10, alignItems: 'center' },
  noAddressBox: { padding: 20, backgroundColor: '#EEE', borderRadius: 10, alignItems: 'center' },
  paymentMethods: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentOption: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 12, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: '#EEE' },
  paymentOptionSelected: { borderColor: '#83c41a', backgroundColor: '#F4F9EB' },
  paymentText: { marginTop: 10, fontWeight: '600', fontSize: 12 },
  cardForm: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginTop: 15 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, fontSize: 14 },
  summaryContainer: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginTop: 30 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#666' },
  summaryValue: { fontWeight: '600' },
  totalBigLabel: { fontSize: 18, fontWeight: 'bold' },
  totalBigValue: { fontSize: 18, fontWeight: 'bold', color: '#83c41a' },
  checkoutFooter: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
  confirmButton: { backgroundColor: '#83c41a', padding: 18, borderRadius: 15, alignItems: 'center' },
  confirmButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: '#FFF', width: '80%', padding: 40, borderRadius: 25, alignItems: 'center' },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, color: '#333' },
  successSub: { fontSize: 16, color: '#888', marginTop: 10, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '80%', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 15 },
  btnCancel: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 12, marginRight: 10, alignItems: 'center' },
  btnCancelText: { color: '#555', fontWeight: 'bold' },
  btnConfirm: { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 12, paddingVertical: 12, marginLeft: 10, alignItems: 'center' },
  btnConfirmText: { color: '#D32F2F', fontWeight: 'bold' },
});