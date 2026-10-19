import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const requiredConfig = [
  ["EXPO_PUBLIC_FIREBASE_API_KEY", process.env.EXPO_PUBLIC_FIREBASE_API_KEY],
  ["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN],
  ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID],
  ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET],
  ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID],
  ["EXPO_PUBLIC_FIREBASE_APP_ID", process.env.EXPO_PUBLIC_FIREBASE_APP_ID],
] as const;

const missingConfig = requiredConfig
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length > 0) {
  throw new Error(`Falta configuración de Firebase: ${missingConfig.join(", ")}`);
}

// Esta configuración es pública en una app móvil; la seguridad real se aplica
// con Firebase App Check, restricciones de la API key y Firestore Rules.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// On native, use AsyncStorage so the Firebase Auth session persists between launches.
// On web, keep Firebase's browser-default persistence.
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export const analytics = isSupported().then((ok) => (ok ? getAnalytics(app) : null));
