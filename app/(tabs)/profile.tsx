import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { signOut, getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/src/config/firebase';

const auth = getAuth();
const { width, height } = Dimensions.get('window');

interface UserProfileData {
  nickname?: string;
  photoURL?: string;
  email?: string;
  phone?: string;
}

interface UserAddress {
  id: string;
  name: string;
  addressLine: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [userAddresses, setUserAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrLine, setNewAddrLine] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [addrToDelete, setAddrToDelete] = useState<string | null>(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoData, setInfoData] = useState({ title: '', content: '', icon: '' });

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserProfileData);
        } else {
          const initialData: UserProfileData = {
            email: user.email ?? undefined,
            nickname: user.displayName || 'Invitado',
            phone: '',
            photoURL: user.photoURL || '',
          };
          await setDoc(userDocRef, initialData);
          setUserData(initialData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2, 
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets[0].base64) {
        const imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImageUri(imageBase64);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (tempNickname.trim().length < 3) return;
    
    setSavingProfile(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const finalPhotoURL = selectedImageUri || userData?.photoURL || "";

      await updateDoc(userDocRef, {
        nickname: tempNickname,
        phone: tempPhone,
        photoURL: finalPhotoURL,
      });

      setUserData(prev => prev ? ({ 
        ...prev, 
        nickname: tempNickname, 
        phone: tempPhone, 
        photoURL: finalPhotoURL 
      }) : null);

      setEditModalVisible(false);
      showSuccessMessage();
    } catch (error) {
      console.log(error);
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchAddresses = async () => {
    if (!user) return;
    setAddressModalVisible(true);
    setLoadingAddresses(true);
    setShowAddAddressForm(false);
    try {
      const addrRef = collection(db, `users/${user.uid}/addresses`);
      const snapshot = await getDocs(addrRef);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAddress));
      setUserAddresses(list);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!newAddrName.trim() || !newAddrLine.trim()) return;
    setSavingAddress(true);
    try {
      const addrRef = collection(db, `users/${user.uid}/addresses`);
      const newDoc = await addDoc(addrRef, {
        name: newAddrName,
        addressLine: newAddrLine,
        createdAt: serverTimestamp()
      });
      setUserAddresses(prev => [...prev, { id: newDoc.id, name: newAddrName, addressLine: newAddrLine }]);
      setNewAddrName('');
      setNewAddrLine('');
      setShowAddAddressForm(false);
      showSuccessMessage();
    } catch (error) {
      console.log(error);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setAddrToDelete(id);
    setDeleteModalVisible(true);
  };

  const confirmDeleteAddress = async () => {
    if (!user || !addrToDelete) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/addresses`, addrToDelete));
      setUserAddresses(prev => prev.filter(item => item.id !== addrToDelete));
      setDeleteModalVisible(false);
      setAddrToDelete(null);
    } catch (e) { 
      console.log(e);
    }
  };

  const requestLogout = () => {
    setLogoutConfirmVisible(true);
  };

  const performLogout = async () => {
    setLogoutConfirmVisible(false); 
    setLoggingOut(true); 
    
    setTimeout(async () => {
      try {
        await signOut(auth);
        router.replace('/login');
      } catch (error) {
        console.log(error);
        setLoggingOut(false);
      }
    }, 1500); 
  };

  const showSuccessMessage = () => {
    setSuccessModalVisible(true);
    setTimeout(() => setSuccessModalVisible(false), 2000);
  };

  const openInfoModal = (type: 'contact' | 'terms') => {
    if (type === 'contact') {
      setInfoData({
        title: 'Contáctanos',
        icon: 'headset',
        content: "📞 Línea nacional: 01 8000 123 456\n\n💬 WhatsApp: +57 300 987 6543\n\n📧 Email: ayuda@freshcaps.com\n\n⏰ Horario: Lun-Sáb, 7am - 7pm"
      });
    } else {
      setInfoData({
        title: 'Términos y Condiciones',
        icon: 'document-text',
        content: "TÉRMINOS Y CONDICIONES DE USO DE FRESHCAPS\n\nÚltima actualización: Noviembre 2025\n\n1. INTRODUCCIÓN\nBienvenido a Freshcaps. Estos términos y condiciones describen las reglas y regulaciones para el uso de la aplicación Freshcaps.\n\n2. LICENCIA\nTodos los derechos de propiedad intelectual están reservados.\n\n3. USO ACEPTABLE\nNo debes usar esta aplicación de ninguna manera que cause daño a la aplicación o menoscabo de la disponibilidad.\n\n4. PRODUCTOS\nFreshcaps se esfuerza por garantizar que todos los productos mostrados estén disponibles y descritos con precisión.\n\n5. ENVÍOS\nLos tiempos de envío son estimados y no están garantizados.\n\n(Texto completo disponible en la web)"
      });
    }
    setInfoModalVisible(true);
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#83c41a" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={styles.decorativeCircle} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {userData?.photoURL ? (
              <Image source={{ uri: userData.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={40} color="#CCC" />
              </View>
            )}
            <TouchableOpacity style={styles.editIconBadge} onPress={() => {
                setTempNickname(userData?.nickname || '');
                setTempPhone(userData?.phone || '');
                setSelectedImageUri(null);
                setEditModalVisible(true);
            }}>
              <Ionicons name="pencil" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.nicknameText}>{userData?.nickname || 'Usuario'}</Text>
          <Text style={styles.emailText}>{userData?.email}</Text>
          {userData?.phone ? <Text style={styles.phoneText}>{userData.phone}</Text> : null}
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.sectionHeader}>CUENTA</Text>
          <View style={styles.menuGroup}>
            <MenuOption 
              icon="create-outline" 
              text="Editar datos personales" 
              onPress={() => {
                setTempNickname(userData?.nickname || '');
                setTempPhone(userData?.phone || '');
                setSelectedImageUri(null);
                setEditModalVisible(true);
              }} 
            />
            <MenuOption 
              icon="location-outline" 
              text="Mis direcciones" 
              onPress={fetchAddresses} 
            />
          </View>

          <Text style={styles.sectionHeader}>SOPORTE E INFORMACIÓN</Text>
          <View style={styles.menuGroup}>
            <MenuOption 
              icon="headset-outline" 
              text="Contáctanos" 
              onPress={() => openInfoModal('contact')}
            />
            <MenuOption 
              icon="document-text-outline" 
              text="Términos y condiciones" 
              onPress={() => openInfoModal('terms')}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => router.push('/pedidos')}>
          <Ionicons name="receipt-outline" size={20} color="#666" style={{ marginRight: 8 }} />
           <Text style={styles.logoutButtonText}>Mis pedidos</Text>
            </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={requestLogout}>
          <Ionicons name="log-out-outline" size={20} color="#666" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{alignItems: 'center'}}>
                <View style={styles.infoIconCircle}>
                  <Ionicons name={infoData.icon as any} size={30} color="#83c41a" />
                </View>
                <Text style={styles.infoTitle}>{infoData.title}</Text>
                <Text style={styles.infoContent}>{infoData.content}</Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.closeInfoBtn} onPress={() => setInfoModalVisible(false)}>
              <Text style={styles.closeInfoText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
              <Text style={styles.modalTitleText}>Editar Perfil</Text>
            </View>
            <ScrollView>
              <View style={styles.editAvatarSection}>
                <Image source={{ uri: selectedImageUri || userData?.photoURL }} style={styles.avatarImageLarge} />
                <TouchableOpacity onPress={pickImage}><Text style={styles.changePhotoText}>Cambiar foto</Text></TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre / Apodo</Text>
                <TextInput style={styles.inputField} value={tempNickname} onChangeText={setTempNickname} placeholder="Ej: Juan Perez" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput style={styles.inputField} value={tempPhone} onChangeText={setTempPhone} keyboardType="phone-pad" placeholder="Ej: 300 123 4567" />
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" visible={addressModalVisible} onRequestClose={() => setAddressModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddressModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
            <Text style={styles.modalTitleText}>Direcciones</Text>
          </View>
          {showAddAddressForm ? (
            <View style={{marginTop: 10}}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.inputField} value={newAddrName} onChangeText={setNewAddrName} placeholder="Ej: Casa, Oficina" />
              <Text style={[styles.label, {marginTop: 15}]}>Dirección</Text>
              <TextInput style={styles.inputField} value={newAddrLine} onChangeText={setNewAddrLine} placeholder="Ej: Calle 123 # 45 - 67" />
              <View style={{flexDirection:'row', marginTop: 25}}>
                <TouchableOpacity onPress={() => setShowAddAddressForm(false)} style={styles.cancelBtn}><Text>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveAddress} style={styles.smallSaveBtn}>
                   {savingAddress ? <ActivityIndicator color="#FFF" /> : <Text style={{color:'#FFF', fontWeight:'bold'}}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.addNewAddrBtn} onPress={() => setShowAddAddressForm(true)}>
                <Ionicons name="add-circle" size={24} color="#83c41a" />
                <Text style={styles.addNewAddrText}>Nueva dirección</Text>
              </TouchableOpacity>
              <FlatList
                data={userAddresses}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.emptyText}>Sin direcciones guardadas.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.addressItem}>
                    <View><Text style={styles.addrName}>{item.name}</Text><Text style={styles.addrLine}>{item.addressLine}</Text></View>
                    <TouchableOpacity onPress={() => handleDeleteRequest(item.id)}>
                      <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </>
          )}
        </View>

        <Modal animationType="fade" transparent={true} visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
           <View style={styles.modalOverlay}>
              <View style={styles.alertCard}>
                 <Text style={styles.alertTitle}>¿Eliminar dirección?</Text>
                 <Text style={styles.alertMessage}>Esta acción no se puede deshacer.</Text>
                 <View style={styles.alertBtnContainer}>
                    <TouchableOpacity style={styles.alertBtnCancel} onPress={() => setDeleteModalVisible(false)}>
                       <Text style={styles.alertBtnTextCancel}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.alertBtnDelete} onPress={confirmDeleteAddress}>
                       <Text style={styles.alertBtnTextDelete}>Borrar</Text>
                    </TouchableOpacity>
                 </View>
              </View>
           </View>
        </Modal>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={successModalVisible}>
        <View style={styles.toastOverlay}>
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={30} color="#FFF" />
            <Text style={styles.toastText}>Guardado</Text>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={logoutConfirmVisible} onRequestClose={() => setLogoutConfirmVisible(false)}>
         <View style={styles.modalOverlay}>
            <View style={styles.alertCard}>
               <Text style={styles.alertTitle}>Cerrar sesión</Text>
               <Text style={styles.alertMessage}>¿Estás seguro de que quieres salir?</Text>
               <View style={styles.alertBtnContainer}>
                  <TouchableOpacity style={styles.alertBtnCancel} onPress={() => setLogoutConfirmVisible(false)}>
                     <Text style={styles.alertBtnTextCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.alertBtnDelete} onPress={performLogout}>
                     <Text style={styles.alertBtnTextDelete}>Salir</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={loggingOut}>
         <View style={styles.logoutOverlay}>
            <View style={styles.logoutContent}>
               <ActivityIndicator size="large" color="#83c41a" />
               <Text style={styles.logoutText}>Cerrando sesión...</Text>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const MenuOption = ({ icon, text, onPress }: { icon: any, text: string, onPress: () => void }) => (
  <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.6}>
    <View style={styles.iconContainer}>
      <Ionicons name={icon} size={22} color="#555" />
    </View>
    <Text style={styles.menuText}>{text}</Text>
    <Ionicons name="chevron-forward" size={18} color="#DDD" style={{marginLeft:'auto'}}/>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerBackground: {
    backgroundColor: '#83c41a',
    height: height * 0.18, 
    width: '100%',
    paddingTop: height * 0.06, 
    alignItems: 'center', 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    position: 'absolute',
    top: 0,
    zIndex: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3,
  },
  decorativeCircle: {
    position: 'absolute',
    top: -height * 0.05, 
    right: -width * 0.08,
    width: width * 0.35, 
    height: width * 0.35,
    borderRadius: (width * 0.35) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  scrollContent: { 
    paddingTop: height * 0.14, 
    paddingBottom: 150,
    paddingHorizontal: 20 
  },

  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4,
    marginBottom: 25,
    zIndex: 2,
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#EEE', borderWidth: 4, borderColor: '#FFF' },
  editIconBadge: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#83c41a',
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF'
  },
  nicknameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  emailText: { fontSize: 13, color: '#888', marginTop: 4 },
  phoneText: { fontSize: 13, color: '#666', marginTop: 2 },

  menuContainer: { marginBottom: 20 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: '#B0B0B0', marginBottom: 10, marginLeft: 10, letterSpacing: 0.5 },
  menuGroup: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  menuOption: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  iconContainer: { width: 30, alignItems: 'center', marginRight: 10 },
  menuText: { fontSize: 15, color: '#333', fontWeight: '500' },

  logoutButton: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  logoutButtonText: { color: '#666', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  infoModalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 25, width: '100%', maxHeight: '80%' },
  infoIconCircle: { backgroundColor: '#E8F5D5', padding: 15, borderRadius: 40, marginBottom: 15 },
  infoTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  infoContent: { fontSize: 14, color: '#555', lineHeight: 20, textAlign: 'left', marginBottom: 25 },
  closeInfoBtn: { backgroundColor: '#83c41a', paddingVertical: 12, borderRadius: 25, alignItems: 'center', width: '100%' },
  closeInfoText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  modalContainer: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  modalTitleText: { fontSize: 18, fontWeight: 'bold', marginLeft: 15 },
  editAvatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarImageLarge: { width: 100, height: 100, borderRadius: 50 },
  changePhotoText: { color: '#83c41a', marginTop: 10, fontWeight: 'bold' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, color: '#666', marginBottom: 5, fontWeight: '600' },
  inputField: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#EEE' },
  saveButton: { backgroundColor: '#83c41a', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold' },

  addNewAddrBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 10 },
  addNewAddrText: { color: '#83c41a', fontWeight: 'bold', marginLeft: 10 },
  addressItem: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', padding: 15, backgroundColor:'#F9F9F9', borderRadius: 12, marginBottom: 10 },
  addrName: { fontWeight: 'bold', fontSize: 15 },
  addrLine: { color: '#666', fontSize: 13 },
  cancelBtn: { flex: 1, backgroundColor: '#EEE', padding: 12, borderRadius: 10, alignItems: 'center', marginRight: 5 },
  smallSaveBtn: { flex: 1, backgroundColor: '#83c41a', padding: 12, borderRadius: 10, alignItems: 'center', marginLeft: 5 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },

  alertCard: { backgroundColor: '#FFF', width: width * 0.85, padding: 25, borderRadius: 20, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  alertMessage: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  alertBtnContainer: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  alertBtnCancel: { flex: 1, padding: 12, backgroundColor: '#F0F0F0', borderRadius: 10, marginRight: 10, alignItems: 'center' },
  alertBtnDelete: { flex: 1, padding: 12, backgroundColor: '#FF4D4D', borderRadius: 10, marginLeft: 10, alignItems: 'center' },
  alertBtnTextCancel: { fontWeight: 'bold', color: '#555' },
  alertBtnTextDelete: { fontWeight: 'bold', color: '#FFF' },

  toastOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  toastContent: { backgroundColor: '#333', padding: 20, borderRadius: 15, alignItems: 'center', flexDirection: 'row' },
  toastText: { color: '#FFF', marginLeft: 10, fontWeight: 'bold' },

  logoutOverlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  logoutContent: { alignItems: 'center' },
  logoutText: { marginTop: 15, fontSize: 16, color: '#83c41a', fontWeight: 'bold' }
});
