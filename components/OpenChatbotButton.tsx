import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, shadow } from "@/constants/designSystem";

export default function OpenChatbotButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.85}
      onPress={() => router.push("/chatbot")}
    >
      <Ionicons name="chatbubble-ellipses" size={26} color={colors.white} />
      <View style={styles.pingDot} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.floating,
  },
  pingDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
