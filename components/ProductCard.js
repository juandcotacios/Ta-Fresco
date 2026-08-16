import { useNavigation } from '@react-navigation/native';
import { addDoc, arrayUnion, collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '@/src/config/firebase';

export default function ProductCard({ product }) {
  const navigation = useNavigation();

  const handleAdd = async () => {
    try {
      const userId = auth.currentUser.uid;
      const cartsQ = query(collection(db, 'carts'), where('userId', '==', userId));
      const snap = await getDocs(cartsQ);

      if (snap.empty) {
        await addDoc(collection(db, 'carts'), {
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