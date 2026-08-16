// chatbot/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MOCK_PRODUCTS = [
  { name: "Manzana", price: 2000 },
  { name: "Banano", price: 1500 },
  { name: "Zanahoria", price: 1000 },
  { name: "Lechuga", price: 1200 },
];

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([{ from: "bot", text: "¡Hola! 👋 Soy tu asistente Frescapp. ¿Qué producto deseas buscar hoy?" }]);

  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null as any);
  const router = useRouter();

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg = {
      from: "user" as const,
      text: input,
    };
    setMessages((prev) => [...prev, userMsg]);

    let botReply = "No encontré productos con ese nombre.";

    const matches = MOCK_PRODUCTS.filter((p) =>
      p.name.toLowerCase().includes(input.toLowerCase())
    );

    if (matches.length > 0) {
      botReply =
        "Aquí tienes lo que encontré:\n" +
        matches.map((p) => `• ${p.name}: $${p.price}`).join("\n");
    }

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: botReply }]);
    }, 600);

    setInput("");
  };

  useEffect(() => {
    // Scroll to bottom cuando hay nuevos mensajes
    setTimeout(() => {
      flatListRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chatbot</Text>
      </View>

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.from === "user" ? styles.userMessage : styles.botMessage,
            ]}
          >
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        style={{ flex: 1 }}
      />

      {/* INPUT */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={input}
          onChangeText={setInput}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },

  header: {
    backgroundColor: "#83c41a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 12,
  },

  message: {
    marginVertical: 6,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: "#83c41a",
    alignSelf: "flex-end",
  },
  botMessage: {
    backgroundColor: "#e9e9e9",
    alignSelf: "flex-start",
  },
  messageText: { color: "#000", fontSize: 15 },

  inputContainer: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 42,
    borderColor: "#e6e6e6",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    color: "#222",
  },
  sendButton: {
    backgroundColor: "#83c41a",
    marginLeft: 10,
    padding: 10,
    borderRadius: 20,
  },
});
