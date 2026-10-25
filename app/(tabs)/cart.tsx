import { radius, shadow } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import { useCart } from "@/src/contexts/CartContext";
import { useAppTheme } from '@/src/contexts/ThemeContext';
import { crearPedido } from "@/src/services/pedidosService";
import { Direccion } from "@/src/services/usuariosService";
import { getOriginalPrice, hasDiscount } from "@/src/utils/pricing";
import { alTopeDeStock, estaAgotado } from "@/src/utils/stock";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import OpenChatbotButton from "../../components/OpenChatbotButton";

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const MIN_ORDER_AMOUNT = 100000;
const auth = getAuth();

export default function CartScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const user = auth.currentUser;

  const { cart, addToCart, increaseCart, decreaseCart, removeFromCart, clearCart } = useCart();

  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [addresses, setAddresses] = useState<Direccion[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'nequi'>('cash');
  const [nequiPhone, setNequiPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardDate, setCardDate] = useState('');
  const [cardCVC, setCardCVC] = useState('');

  const [upsellProducts, setUpsellProducts] = useState<any[]>([]);
  const [loadingUpsell, setLoadingUpsell] = useState(true);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Los productos agotados quedan visibles en el carrito, pero no se cobran
  // ni cuentan para el pedido: no se pueden comprar hasta que vuelvan a tener stock.
  const itemsComprables = useMemo(
    () => cart.filter((item: any) => !estaAgotado(item.stock)),
    [cart]
  );
  const totalPrice = useMemo(() => {
    return itemsComprables.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
  }, [itemsComprables]);

  const isMinMet = totalPrice >= MIN_ORDER_AMOUNT;

  const fetchAddresses = async () => {
    if (!user) {
      setLoadingAddresses(false);
      return;
    }
    setLoadingAddresses(true);
    try {
      const q = collection(db, `users/${user.uid}/addresses`);
      const snapshot = await getDocs(q);
      const addressList = snapshot.docs.map(
        doc => ({ id: doc.id, ...doc.data() } as Direccion)
      );

      setAddresses(addressList);
      if (addressList.length > 0) {
        setSelectedAddress((prev) => prev && addressList.some(a => a.id === prev) ? prev : addressList[0].id);
      } else {
        setSelectedAddress(null);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  useEffect(() => {
    const fetchUpsellProducts = async () => {
      try {
        const snapshot = await getDocs(collection(db, "Productos"));
        const products = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Producto",
            price: data.price || 0,
            // Solo se muestra descuento si es el configurado de verdad en el catálogo.
            discountPercent: Number(data.discountPercent) || 0,
            imageUrl: data.imageUrl || "https://via.placeholder.com/100",
            category: data.category || "Varios",
            // Antes era `|| 99`: como 0 es "falsy", un producto realmente
            // agotado (stock: 0) se mostraba aquí con un stock falso de 99 y
            // se podía agregar y comprar sin que nada lo bloqueara. `?? 0`
            // conserva el 0 real.
            stock: data.stock ?? 0,
            proveedorId: data.proveedorId || "",
          };
        });
        const cartIds = cart.map((c: any) => c.id);
        const filtered = products.filter(p => !cartIds.includes(p.id)).slice(0, 5);
        setUpsellProducts(filtered);
      } catch (error) { console.log(error); }
      finally { setLoadingUpsell(false); }
    };
    fetchUpsellProducts();
  }, [cart]);

  const handleIncrease = (item: any) => increaseCart(item.id);

  const handleDecrease = (item: any) => {
    // Con 1 unidad, decreaseCart quita la línea: se anima la salida.
    if (item.quantity <= 1) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    decreaseCart(item.id);
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
    setCheckoutError(null);
    if (!user) {
       setCheckoutError("Debes iniciar sesión para confirmar el pedido.");
       return;
    }
    if (addresses.length === 0) {
       Alert.alert(
         "Falta una dirección",
         "Debes agregar una dirección de entrega antes de confirmar tu pedido.",
         [
           { text: "Cancelar", style: "cancel" },
           { text: "Agregar dirección", onPress: () => { setCheckoutVisible(false); router.push("/profile"); } },
         ]
       );
       return;
    }
    if (!selectedAddress) {
       setCheckoutError("Selecciona una dirección de entrega.");
       return;
    }
    if (paymentMethod === 'card') {
        if (cardNumber.length < 13 || cardDate.length < 5 || cardCVC.length < 3) {
            setCheckoutError("Verifica los datos de la tarjeta.");
            return;
        }
    }
    if (paymentMethod === 'nequi') {
        if (nequiPhone.replace(/\D/g, '').length < 10) {
            setCheckoutError("Escribe un número de celular válido para Nequi.");
            return;
        }
    }

    if (itemsComprables.length === 0) {
        setCheckoutError("Los productos de tu carrito están agotados. Quítalos o espera a que vuelvan a tener stock.");
        return;
    }

    setProcessingPayment(true);
    try {
        const addressObj = addresses.find(a => a.id === selectedAddress);
        await crearPedido(
          user.uid,
          itemsComprables,
          totalPrice,
          3500,
          addressObj ? { name: addressObj.name, addressLine: addressObj.addressLine } : null,
          paymentMethod
        );
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
        setCheckoutError(error?.message || "No se pudo confirmar el pedido. Intenta de nuevo.");
    }
  };
  if (!cart || cart.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Tu pedido" onBack={() => router.back()} colors={colors} styles={styles} />
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
               <Ionicons name="cart-outline" size={80} color={colors.border} />
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
      <Header title="Tu pedido" onBack={() => router.back()} colors={colors} styles={styles} />

      <ScrollView contentContainerStyle={{ paddingBottom: 250 }} showsVerticalScrollIndicator={false}>
        {!isMinMet ? (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>Faltan ${(MIN_ORDER_AMOUNT - totalPrice).toLocaleString()} para el mínimo.</Text>
          </View>
        ) : (
          <View style={styles.successBanner}>
             <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
             <Text style={styles.successText}>¡Pedido mínimo alcanzado!</Text>
          </View>
        )}

        <View style={styles.listContainer}>
          {cart.map((item: any) => (
            <CartItemRow
              colors={colors}
              styles={styles}
              key={item.id}
              item={item}
              onIncrease={() => handleIncrease(item)}
              onDecrease={() => handleDecrease(item)}
              onRemove={() => removeFromCart(item.id)}
            />
          ))}
        </View>

        <TouchableOpacity onPress={() => setClearModalVisible(true)} style={styles.cleanBtn}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.clearCartText}>Vaciar carrito</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.upsellSection}>
            <Text style={styles.upsellTitle}>Productos que te podrían gustar</Text>
            {loadingUpsell ? <ActivityIndicator color={colors.primary} /> : (
              <FlatList
                data={upsellProducts}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
                keyExtractor={item => item.id}
                renderItem={({item}) => {
                  const enCarrito = cart.find((c: any) => c.id === item.id);
                  return (
                    <UpsellCard
                      colors={colors}
                      styles={styles}
                      item={item}
                      cantidad={enCarrito?.quantity || 0}
                      onAdd={() => addToCart({ ...item, quantity: 1 })}
                      onIncrease={() => increaseCart(item.id)}
                      onDecrease={() => decreaseCart(item.id)}
                    />
                  );
                }}
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
          onPress={() => { fetchAddresses(); setCheckoutError(null); setCheckoutVisible(true); }}
        >
          <Text style={styles.payButtonText}>Ir a Pagar</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} style={{marginLeft: 5}}/>
        </TouchableOpacity>
      </View>

      <Modal visible={checkoutVisible} animationType="slide" presentationStyle="pageSheet">
       <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
         <View style={styles.checkoutContainer}>
            <View style={styles.checkoutHeader}>
                <Text style={styles.checkoutTitle}>Finalizar Pedido</Text>
                <TouchableOpacity onPress={() => setCheckoutVisible(false)}>
                   <Ionicons name="close-circle" size={30} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
                <Text style={styles.sectionHeader}>¿Dónde lo enviamos?</Text>

                {loadingAddresses ? (
                   <ActivityIndicator color={colors.primary} style={{marginBottom: 20}}/>
                ) : addresses.length === 0 ? (
                   <View style={styles.noAddressBox}>
                      <Text style={{color: colors.textSecondary, marginBottom: 10}}>No tienes direcciones guardadas.</Text>
                      <TouchableOpacity onPress={() => {setCheckoutVisible(false); router.push("/profile")}} style={styles.addAddressBtnSmall}>
                         <Text style={{color: colors.white, fontWeight:'bold'}}>Ir a Perfil a crear una</Text>
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
                            <Ionicons name={selectedAddress === addr.id ? "radio-button-on" : "radio-button-off"} size={20} color={selectedAddress === addr.id ? colors.primary : colors.textMuted} />
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
                      <Ionicons name="cash-outline" size={22} color={colors.textPrimary} />
                      <Text style={styles.paymentText}>Contraentrega</Text>
                   </TouchableOpacity>
                   <TouchableOpacity
                      style={[styles.paymentOption, paymentMethod === 'nequi' && styles.paymentOptionSelected]}
                      onPress={() => setPaymentMethod('nequi')}
                   >
                      <View style={styles.nequiDot}><Text style={styles.nequiDotText}>N</Text></View>
                      <Text style={styles.paymentText}>Nequi</Text>
                   </TouchableOpacity>
                   <TouchableOpacity
                      style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
                      onPress={() => setPaymentMethod('card')}
                   >
                      <Ionicons name="card-outline" size={22} color={colors.textPrimary} />
                      <Text style={styles.paymentText}>Tarjeta</Text>
                   </TouchableOpacity>
                </View>

                {paymentMethod !== 'cash' && (
                  <View style={styles.paymentDemoNotice}>
                    <Ionicons name="information-circle-outline" size={19} color={colors.warningText} />
                    <Text style={styles.paymentDemoNoticeText}>
                      Pago de prueba: no se realiza ningún cobro ni se envían datos a Nequi o a un banco. Usa datos ficticios.
                    </Text>
                  </View>
                )}

                {paymentMethod === 'nequi' && (
                    <View style={styles.cardForm}>
                        <View style={styles.nequiBanner}>
                          <View style={[styles.nequiDot, { width: 34, height: 34, borderRadius: 17 }]}>
                            <Text style={[styles.nequiDotText, { fontSize: 16 }]}>N</Text>
                          </View>
                          <Text style={styles.nequiBannerText}>
                            Este paso solo simula la aprobación. La app no se conecta con Nequi ni envía notificaciones.
                          </Text>
                        </View>
                        <Text style={styles.label}>Número de celular Nequi</Text>
                        <TextInput
                           placeholder="000 000 0000 (prueba)"
                           style={styles.input}
                           keyboardType="number-pad"
                           maxLength={10}
                           returnKeyType="done"
                           value={nequiPhone}
                           onChangeText={(t) => setNequiPhone(t.replace(/[^0-9]/g, ''))}
                        />
                    </View>
                )}

                {paymentMethod === 'card' && (
                    <View style={styles.cardForm}>
                        <View style={styles.creditCardPreview}>
                          <View style={styles.creditCardTopRow}>
                            <Ionicons name="wifi" size={20} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: '90deg' }] }} />
                            <Text style={styles.creditCardBrand}>
                              {cardNumber.startsWith('4') ? 'VISA' : cardNumber.startsWith('5') ? 'MASTERCARD' : 'TARJETA'}
                            </Text>
                          </View>
                          <Text style={styles.creditCardNumber}>
                            {(cardNumber || '•••• •••• •••• ••••').padEnd(16, '•').match(/.{1,4}/g)?.join('  ')}
                          </Text>
                          <View style={styles.creditCardBottomRow}>
                            <View>
                              <Text style={styles.creditCardSmallLabel}>TITULAR</Text>
                              <Text style={styles.creditCardValue}>{cardName || 'NOMBRE APELLIDO'}</Text>
                            </View>
                            <View>
                              <Text style={styles.creditCardSmallLabel}>VENCE</Text>
                              <Text style={styles.creditCardValue}>{cardDate || 'MM/YY'}</Text>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.label}>Número de Tarjeta</Text>
                        <TextInput
                           placeholder="0000 0000 0000 0000"
                           style={styles.input} keyboardType="number-pad" maxLength={16} returnKeyType="next"
                           value={cardNumber} onChangeText={handleCardNumberChange}
                        />
                         <Text style={styles.label}>Nombre del titular</Text>
                         <TextInput placeholder="Nombre de prueba" style={styles.input} value={cardName} onChangeText={setCardName} returnKeyType="next" />
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                           <View style={{width: '48%'}}>
                              <Text style={styles.label}>Fecha (MM/YY)</Text>
                              <TextInput placeholder="MM/YY" style={styles.input} maxLength={5} keyboardType="number-pad" value={cardDate} onChangeText={handleDateChange} returnKeyType="next" />
                           </View>
                           <View style={{width: '48%'}}>
                              <Text style={styles.label}>CVC</Text>
                              <TextInput placeholder="000" style={styles.input} maxLength={3} keyboardType="number-pad" value={cardCVC} onChangeText={handleCVCChange} returnKeyType="done" />
                           </View>
                        </View>
                    </View>
                )}

                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>${totalPrice.toLocaleString()}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Envío</Text><Text style={styles.summaryValue}>$3,500</Text></View>
                    <View style={[styles.summaryRow, {marginTop: 10, borderTopWidth:1, borderColor: colors.divider, paddingTop:10}]}>
                        <Text style={styles.totalBigLabel}>Total</Text><Text style={styles.totalBigValue}>${(totalPrice + 3500).toLocaleString()}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.checkoutFooter}>
                {checkoutError && (
                  <View style={styles.checkoutErrorBanner}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    <Text style={styles.checkoutErrorText}>{checkoutError}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.confirmButton} onPress={handlePay} disabled={processingPayment}>
                    {processingPayment ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmButtonText}>Confirmar Pedido</Text>}
                </TouchableOpacity>
            </View>
         </View>
       </KeyboardAvoidingView>
      </Modal>

      <Modal visible={successVisible} transparent animationType="fade">
          <View style={styles.successOverlay}>
             <View style={styles.successCard}>
                <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
                <Text style={styles.successTitle}>¡Pedido Realizado!</Text>
                <Text style={styles.successSub}>Tu pedido llegará pronto.</Text>
             </View>
          </View>
      </Modal>

      <CustomModal colors={colors} styles={styles} visible={clearModalVisible} onClose={() => setClearModalVisible(false)} onConfirm={() => { clearCart(); setClearModalVisible(false); }} />
    </View>
  );
}

const Header = ({ title, onBack, colors, styles }: any) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.backCircle}><Ionicons name="chevron-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const CartItemRow = ({ item, onIncrease, onDecrease, onRemove, colors, styles }: any) => {
  const sinStock = estaAgotado(item.stock);
  return (
  <View style={styles.cartItem}>
    <View>
      <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
      {sinStock && (
        <View style={styles.itemAgotadoBadge}>
          <Text style={styles.itemAgotadoBadgeText}>AGOTADO</Text>
        </View>
      )}
    </View>
    <View style={styles.itemInfo}>
      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.itemCategory}>{item.category}</Text>
      <View style={styles.itemPriceRow}>
        <Text style={styles.itemPrice}>${item.price.toLocaleString()}</Text>
        {!!getOriginalPrice(item.price, item.discountPercent) && (
          <>
            <Text style={styles.itemOldPrice}>${getOriginalPrice(item.price, item.discountPercent)?.toLocaleString()}</Text>
            <View style={styles.itemDiscountPill}>
              <Text style={styles.itemDiscountPillText}>-{item.discountPercent}%</Text>
            </View>
          </>
        )}
      </View>
    </View>
    {sinStock ? (
      <View style={styles.itemAgotadoActions}>
        <View style={styles.itemAgotadoPill}>
          <Text style={styles.itemAgotadoPillText}>Agotado</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.itemAgotadoRemove}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.qtyContainer}>
        <TouchableOpacity style={[styles.qtyBtn, item.quantity === 1 ? styles.qtyBtnRed : styles.qtyBtnGray]} onPress={onDecrease}>
          <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={item.quantity === 1 ? colors.white : colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={[styles.qtyBtn, styles.qtyBtnGreen, alTopeDeStock(item.quantity, item.stock) && { opacity: 0.3 }]}
          onPress={alTopeDeStock(item.quantity, item.stock) ? undefined : onIncrease}
          disabled={alTopeDeStock(item.quantity, item.stock)}
        >
          <Ionicons name="add" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
    )}
  </View>
  );
};

const UpsellCard = ({ item, cantidad, onAdd, onIncrease, onDecrease, colors, styles }: any) => {
  const sinStock = estaAgotado(item.stock);
  const alTope = alTopeDeStock(cantidad, item.stock);
  const originalPrice = getOriginalPrice(item.price, item.discountPercent);

  return (
    <View style={styles.upsellCard}>
      {hasDiscount(item.discountPercent) && (
        <View style={styles.upsellDiscountTag}>
          <Text style={styles.upsellDiscountText}>-{item.discountPercent}%</Text>
        </View>
      )}
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.imageUrl }} style={styles.upsellImage} />
        {sinStock && (
          <View style={styles.upsellAgotadoBadge}>
            <Text style={styles.upsellAgotadoBadgeText}>AGOTADO</Text>
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 5 }}>
        <View style={styles.upsellPriceRow}>
          <Text style={styles.upsellPrice}>${item.price.toLocaleString()}</Text>
          {!!originalPrice && <Text style={styles.upsellOldPrice}>${originalPrice.toLocaleString()}</Text>}
        </View>
        <Text style={styles.upsellName} numberOfLines={2}>{item.name}</Text>
      </View>

      {sinStock ? (
        <View style={[styles.upsellAddBtn, styles.upsellOutOfStock]}>
          <Text style={[styles.upsellAddBtnText, styles.outOfStockText]}>Agotado</Text>
        </View>
      ) : cantidad === 0 ? (
        <TouchableOpacity style={styles.upsellAddBtn} onPress={onAdd}>
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.upsellAddBtnText}>Agregar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.upsellQtyRow}>
          <TouchableOpacity style={styles.upsellQtyBtn} onPress={onDecrease}>
            <Ionicons name={cantidad === 1 ? "trash-outline" : "remove"} size={13} color={colors.danger} />
          </TouchableOpacity>
          <Text style={styles.upsellQtyText}>{cantidad}</Text>
          <TouchableOpacity
            style={[styles.upsellQtyBtn, { backgroundColor: alTope ? "#ccc" : colors.primary }]}
            onPress={alTope ? undefined : onIncrease}
            disabled={alTope}
          >
            <Ionicons name="add" size={13} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const CustomModal = ({ visible, onClose, onConfirm, colors, styles }: any) => (
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

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: height * 0.15 },
  emptyIconContainer: { backgroundColor: colors.primaryLight, padding: 30, borderRadius: 100, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 30 },
  goToStoreBtn: { backgroundColor: colors.primary, paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30, ...shadow.button },
  goToStoreText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  warningBanner: { backgroundColor: colors.warningLight, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  warningText: { color: '#B45309', marginLeft: 8, fontSize: 13, fontWeight: '500' },
  successBanner: { backgroundColor: colors.successLight, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  successText: { color: colors.primaryDark, marginLeft: 8, fontSize: 13, fontWeight: 'bold' },
  listContainer: { padding: 20, backgroundColor: colors.surface, marginTop: 10, borderRadius: radius.xl, marginHorizontal: 15, ...shadow.card },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 15 },
  itemImage: { width: 65, height: 65, resizeMode: 'contain', marginRight: 15, backgroundColor: colors.background, borderRadius: 10 },
  itemAgotadoBadge: { position: 'absolute', top: 2, left: 2, backgroundColor: colors.danger, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, zIndex: 2 },
  itemAgotadoBadgeText: { color: colors.white, fontSize: 8, fontWeight: 'bold' },
  itemAgotadoActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemAgotadoPill: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  itemAgotadoPillText: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  itemAgotadoRemove: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  itemCategory: { fontSize: 12, color: colors.textMuted, marginBottom: 5 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center' },
  itemOldPrice: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'line-through', marginLeft: 7 },
  // La fila del carrito es muy angosta para un badge sobre la imagen (65x65,
  // ya ocupada por "AGOTADO"), así que el descuento va como una píldora
  // junto al precio, en el mismo verde que el badge de descuento del resto
  // de la app, en vez del rojo que antes lo confundía con "agotado".
  itemDiscountPill: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 5 },
  itemDiscountPillText: { color: colors.primaryDarker, fontSize: 10, fontWeight: '800' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 20, padding: 4 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  qtyBtnRed: { backgroundColor: colors.dangerLight },
  qtyBtnGreen: { backgroundColor: colors.primary },
  qtyBtnGray: { backgroundColor: '#E0E0E0' },
  qtyText: { marginHorizontal: 12, fontWeight: 'bold', fontSize: 15 },
  cleanBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  clearCartText: { color: colors.danger, fontSize: 13, fontWeight: '600', marginLeft: 5 },
  divider: { height: 10 },
  upsellSection: { marginTop: 10, paddingLeft: 20 },
  upsellTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: colors.textPrimary },
  upsellCard: { width: 150, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, marginRight: 15, marginBottom: 10, ...shadow.card },
  // Mismo diseño de badge de descuento y de "AGOTADO" que el resto de
  // pantallas con productos (inicio, ofertas, tienda): descuento en verde
  // arriba a la derecha, agotado en rojo arriba a la izquierda, para que
  // nunca se encimen y se vean igual en toda la app.
  upsellDiscountTag: { position: 'absolute', top: 6, right: 6, zIndex: 3, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  upsellDiscountText: { color: colors.primaryDarker, fontSize: 11, fontWeight: '800' },
  upsellAgotadoBadge: { position: 'absolute', top: 6, left: 6, zIndex: 2, backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  upsellAgotadoBadgeText: { color: colors.white, fontSize: 10, fontWeight: 'bold' },
  upsellPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  upsellOldPrice: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through' },
  upsellAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 6, marginTop: 6, gap: 4 },
  upsellAddBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  upsellOutOfStock: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  outOfStockText: { color: colors.textPrimary },
  upsellQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  upsellQtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EFEFEF', justifyContent: 'center', alignItems: 'center' },
  upsellQtyText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  imageContainer: { width: '100%', height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  upsellImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  upsellPrice: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary },
  upsellName: { fontSize: 12, color: colors.textSecondary, marginTop: 2, height: 32 },
  footerCard: { position: 'absolute', bottom: 80, left: 20, right: 20, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 15, borderRadius: radius.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000, ...shadow.floating },
  totalSection: { flexDirection: 'column' },
  totalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  payButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  payButtonActive: { backgroundColor: colors.primary, ...shadow.button },
  payButtonDisabled: { backgroundColor: '#E0E0E0' },
  payButtonText: { color: colors.white, fontSize: 15, fontWeight: 'bold' },
  chatbotContainer: { position: "absolute", bottom: 160, right: 20, zIndex: 999 },
  checkoutContainer: { flex: 1, backgroundColor: colors.background },
  checkoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: colors.surface },
  checkoutTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 15, color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 5, fontWeight: '600', marginTop: 10 },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: colors.border, width: width * 0.6 },
  addressCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  addrAlias: { fontWeight: 'bold', fontSize: 14, color: colors.textPrimary },
  addrText: { fontSize: 12, color: colors.textSecondary },
  addAddressBtnSmall: { marginTop: 10, backgroundColor: colors.primary, padding: 10, borderRadius: 10, alignItems: 'center' },
  noAddressBox: { padding: 20, backgroundColor: '#EEE', borderRadius: 10, alignItems: 'center' },
  paymentMethods: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentOption: { flex: 1, backgroundColor: colors.surface, padding: 20, borderRadius: 12, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: colors.border },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  paymentText: { marginTop: 10, fontWeight: '600', fontSize: 12, color: colors.textPrimary },
  cardForm: { backgroundColor: colors.surface, padding: 20, borderRadius: 12, marginTop: 15 },
  input: { backgroundColor: colors.background, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary },
  paymentDemoNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.warningLight, borderRadius: 10, padding: 12, marginTop: 12 },
  paymentDemoNoticeText: { flex: 1, color: colors.warningText, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  nequiDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#8A2BE2', justifyContent: 'center', alignItems: 'center' },
  nequiDotText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  nequiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.infoLight, borderRadius: 12, padding: 12, marginBottom: 16 },
  nequiBannerText: { flex: 1, marginLeft: 10, fontSize: 12, lineHeight: 17, color: colors.textPrimary },
  creditCardPreview: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    height: 170,
    justifyContent: 'space-between',
  },
  creditCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditCardBrand: { color: colors.white, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  creditCardNumber: { color: colors.white, fontSize: 19, letterSpacing: 2, fontWeight: '600' },
  creditCardBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  creditCardSmallLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 2 },
  creditCardValue: { color: colors.white, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  summaryContainer: { backgroundColor: colors.surface, padding: 20, borderRadius: 12, marginTop: 30 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: colors.textSecondary },
  summaryValue: { fontWeight: '600', color: colors.textPrimary },
  totalBigLabel: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  totalBigValue: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  checkoutFooter: { padding: 20, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  checkoutErrorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerLight, padding: 10, borderRadius: 10, marginBottom: 12 },
  checkoutErrorText: { color: colors.danger, marginLeft: 8, fontSize: 12, flex: 1, fontWeight: '600' },
  confirmButton: { backgroundColor: colors.primary, padding: 18, borderRadius: 15, alignItems: 'center' },
  confirmButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 18 },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: colors.surface, width: '80%', padding: 40, borderRadius: 25, alignItems: 'center' },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, color: colors.textPrimary },
  successSub: { fontSize: 16, color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.surface, width: '80%', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 15 },
  btnCancel: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 12, marginRight: 10, alignItems: 'center' },
  btnCancelText: { color: colors.textSecondary, fontWeight: 'bold' },
  btnConfirm: { flex: 1, backgroundColor: colors.dangerLight, borderRadius: 12, paddingVertical: 12, marginLeft: 10, alignItems: 'center' },
  btnConfirmText: { color: colors.danger, fontWeight: 'bold' },
});
