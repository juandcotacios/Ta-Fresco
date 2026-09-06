import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { TiendaConId } from "@/src/services/tiendaService";
import { obtenerPromedioProveedor } from "@/src/services/valoracionesService";

export default function TiendasScreen() {
  const router = useRouter();
  const [tiendas, setTiendas] = useState<TiendaConId[]>([]);
  const [ratings, setRatings] = useState<Record<string, { promedio: number; cantidad: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "tiendas"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setTiendas(data);
        setLoading(false);
        data.forEach((t: any) => {
          obtenerPromedioProveedor(t.id).then((r) => {
            setRatings((prev) => ({ ...prev, [t.id]: r }));
          });
        });
      },
      (error) => {
        console.log(error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Tiendas</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#83c41a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tiendas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Todavía no hay tiendas registradas.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tiendas/${item.id}`)}
            >
              <View style={styles.storeIcon}>
                <Ionicons name="storefront" size={26} color="#83c41a" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.name}>{item.nombre || "Tienda sin nombre"}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción todavía."}
                </Text>
                {ratings[item.id] && ratings[item.id].cantidad > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="star" size={13} color="#f0a500" />
                    <Text style={{ fontSize: 12, color: "#666", marginLeft: 3 }}>
                      {ratings[item.id].promedio.toFixed(1)} ({ratings[item.id].cantidad})
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        />
      )}
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
  title: { fontSize: 20, fontWeight: "bold", color: "#333" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EAF6D8",
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontWeight: "bold", fontSize: 15, color: "#333" },
  desc: { color: "#888", fontSize: 12, marginTop: 3 },
});