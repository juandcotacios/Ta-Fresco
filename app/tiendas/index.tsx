import { colors, radius, shadow } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import { TiendaConId } from "@/src/services/tiendaService";
import { obtenerPromedioProveedor } from "@/src/services/valoracionesService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Tiendas</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
                <Ionicons name="storefront" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.name}>{item.nombre || "Tienda sin nombre"}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción todavía."}
                </Text>
                {ratings[item.id] && ratings[item.id].cantidad > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Ionicons name="star" size={13} color="#f0a500" />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 3 }}>
                      {ratings[item.id].promedio.toFixed(1)} ({ratings[item.id].cantidad})
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
    marginRight: 12,
    ...shadow.card,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    ...shadow.card,
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontWeight: "bold", fontSize: 15, color: colors.textPrimary },
  desc: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
});
