import { useNavigation } from '@react-navigation/native';
import { arrayUnion, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '@/src/config/firebase';

export default function ProductCard({ product }) {
  const navigation = useNavigation();

  const handleAdd = async () => {
    try {
      const userId = auth.currentUser.uid;
      // buscar carrito del usuario
      const cartsQ = query(collection(db, 'carts'), where('userId', '==', userId));
      const snap = await getDocs(cartsQ);

      if (snap.empty) {
        // crear carrito nuevo
        await doc(collection(db, 'carts')).set
      }

      // simplificamos usando update on first cart doc (si existe) o crear uno nuevo
      if (snap.empty) {
        await db.collection('carts').add({
          userId,
          items: [{
            productId: product.id,
            name: product.name,
            priceAtAdd: product.price,
            quantity: 1,
            imageUrl: product.imageUrl || null
          }]
        });
      } else {
        const cartRef = snap.docs[0].ref;
        await updateDoc(cartRef, {
          items: arrayUnion({
            productId: product.id,
            name: product.name,
            priceAtAdd: product.price,
            quantity: 1,
            imageUrl: product.imageUrl || null
          })
        });
      }

      alert('Producto agregado al carrito');
    } catch (e) {
      console.log(e);
      alert('Error agregando al carrito: ' + e.message);
    }
  };

  return (
    <View style={{width:160, margin:8, backgroundColor:'#fff', borderRadius:10, padding:8, elevation:2}}>
      <Image source={{uri: product.imageUrl}} style={{height:90, borderRadius:8}} />
      <Text numberOfLines={1} style={{fontWeight:'600'}}>{product.name}</Text>
      <Text style={{marginTop:6}}>${product.price}</Text>
      <TouchableOpacity onPress={handleAdd} style={{marginTop:8, backgroundColor:'#7DDC2F', padding:6, borderRadius:8, alignItems:'center'}}>
        <Text>Añadir</Text>
      </TouchableOpacity>
    </View>
  );
}
