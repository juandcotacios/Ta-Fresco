import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { getAuth } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import {
  obtenerMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  ProductoTendero,
} from "@/src/services/tiendaService";
import { subirImagenCloudinary } from "@/src/services/cloudinaryService";

const CATEGORIAS = ["Hortalizas", "Frutas", "Abarrotes", "Tuberculos", "Verduras"];

export default function MisProductosScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [productos, setProductos] = useState<ProductoTendero[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIAS[0]);
  const [imageUrl, setImageUrl] = useState(""); // URL final (ya subida a Cloudinary)
  const [imagenLocal, setImagenLocal] = useState<string | null>(null); // preview antes de subir
  const [stock, setStock] = useState("");

  const cargar = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await obtenerMisProductos(user.uid);
    setProductos(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  const abrirNuevo = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setCategory(CATEGORIAS[0]);
    setImageUrl("");
    setImagenLocal(null);
    setStock("");
    setModalVisible(true);
  };

  const abrirEditar = (p: ProductoTendero) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(String(p.price));
    setCategory(p.category || CATEGORIAS[0]);
    setImageUrl(p.imageUrl || "");
    setImagenLocal(null);
    setStock(String(p.stock ?? 0));
    setModalVisible(true);
  };

  const elegirFoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para elegir la imagen del producto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      setImagenLocal(dataUri);

      setSubiendoFoto(true);
      const url = await subirImagenCloudinary(dataUri);
      setImageUrl(url);
    } catch (error: any) {
      console.log(error);
      Alert.alert("Error", error?.message || "No se pudo subir la imagen.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleGuardar = async () => {
    if (!user) return;
    const precioNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);
    if (name.trim().length < 2) {
      Alert.alert("Falta el nombre", "Escribe el nombre del producto.");
      return;
    }
    if (isNaN(precioNum) || precioNum <= 0) {
      Alert.alert("Precio inválido", "Escribe un precio válido.");
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert("Stock inválido", "Escribe una cantidad válida.");
      return;
    }
    if (subiendoFoto) {
      Alert.alert("Espera", "La imagen todavía se está subiendo.");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        price: precioNum,
        category,
        imageUrl: imageUrl.trim(),
        stock: stockNum,
      };
      if (editingId) {
        await actualizarProducto(editingId, data);
      } else {
        await crearProducto(user.uid, data);
      }
      setModalVisible(false);
      cargar();
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = (p: ProductoTendero) => {
    Alert.alert("Eliminar producto", `¿Eliminar "${p.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarProducto(p.id);
            cargar();
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Productos</Text>
        <TouchableOpacity onPress={abrirNuevo} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#83c41a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Todavía no has añadido productos. Tocá el + para crear el primero.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image
                source={{ uri: item.imageUrl || "https://via.placeholder.com/60" }}
                style={styles.thumb}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.category} · Stock: {item.stock}</Text>
                <Text style={styles.price}>${item.price.toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => abrirEditar(item)} style={styles.iconBtn}>
                <Ionicons name="create-outline" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleEliminar(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingTop: 30 }}>
          <Text style={styles.modalTitle}>{editingId ? "Editar producto" : "Nuevo producto"}</Text>

          <Text style={styles.label}>Foto del producto</Text>
          <TouchableOpacity style={styles.photoBox} onPress={elegirFoto} disabled={subiendoFoto}>
            {subiendoFoto ? (
              <ActivityIndicator color="#83c41a" />
            ) : imagenLocal || imageUrl ? (
              <Image source={{ uri: imagenLocal || imageUrl }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color="#999" />
                <Text style={styles.photoPlaceholderText}>Toca para elegir una foto</Text>
              </View>
            )}
          </TouchableOpacity>
          {(imagenLocal || imageUrl) && !subiendoFoto && (
            <TouchableOpacity onPress={elegirFoto}>
              <Text style={styles.changePhotoText}>Cambiar foto</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Nombre</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Tomate - kg" />

          <Text style={styles.label}>Precio</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="Ej: 3500"
          />

          <Text style={styles.label}>Stock disponible</Text>
          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            keyboardType="numeric"
            placeholder="Ej: 20"
          />

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.catRow}>
            {CATEGORIAS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.catChip, category === c && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, subiendoFoto && { opacity: 0.6 }]}
            onPress={handleGuardar}
            disabled={saving || subiendoFoto}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#333", flex: 1 },
  addBtn: {
    backgroundColor: "#83c41a",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  thumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: "#eee" },
  name: { fontWeight: "bold", fontSize: 14, color: "#333" },
  meta: { color: "#888", fontSize: 12, marginTop: 2 },
  price: { color: "#83c41a", fontWeight: "bold", marginTop: 2 },
  iconBtn: { padding: 6, marginLeft: 4 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20, color: "#333" },
  label: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 14, fontWeight: "600" },
  input: { backgroundColor: "#F5F5F5", borderRadius: 10, padding: 14, fontSize: 15 },
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
  },
  photoPreview: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center", padding: 10 },
  photoPlaceholderText: { color: "#999", fontSize: 11, textAlign: "center", marginTop: 6 },
  changePhotoText: { color: "#83c41a", fontWeight: "600", marginTop: 8, fontSize: 13 },
  catRow: { flexDirection: "row", flexWrap: "wrap" },
  catChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  catChipActive: { backgroundColor: "#83c41a", borderColor: "#83c41a" },
  catChipText: { color: "#666", fontSize: 13 },
  catChipTextActive: { color: "#fff", fontWeight: "bold" },
  saveBtn: {
    backgroundColor: "#83c41a",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { alignItems: "center", marginTop: 14, marginBottom: 20 },
  cancelBtnText: { color: "#999", fontSize: 14 },
});
