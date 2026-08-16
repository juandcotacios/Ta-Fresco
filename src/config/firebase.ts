import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCEgM0gLhzj9h_rxxczMlsRHhkuCrySw_4",
  authDomain: "tafresco.firebaseapp.com",
  projectId: "tafresco",
  storageBucket: "tafresco.firebasestorage.app",
  messagingSenderId: "799200713865",
  appId: "1:799200713865:web:29963b4fd6c18e0c80ba58",
  measurementId: "G-24B2E960CC",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export const analytics = isSupported().then((ok) => (ok ? getAnalytics(app) : null));