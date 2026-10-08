import { colors, radius } from "@/constants/designSystem";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        animation: 'fade',

        tabBarStyle: {
          backgroundColor: colors.primary,
          height: Platform.OS === 'ios' ? 90 : 75,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: colors.primaryDarker,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: "rgba(255,255,255,0.6)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          marginBottom: 5,
        },
      }}
    >
      {}
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={26} color={color} />
          ),
        }}
      />

      {}
      <Tabs.Screen
        name="ofertas"
        options={{
          title: "Ofertas",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "pricetag" : "pricetag-outline"} size={26} color={color} />
          ),
        }}
      />

      {}
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrito",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cart" : "cart-outline"} size={28} color={color} />
          ),
        }}
      />

      {}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
