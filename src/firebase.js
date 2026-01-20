import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA71J0GX1-3PBQXfWA8zmBMQLJrOxwK1RY",
  authDomain: "sales-management-76f5c.firebaseapp.com",
  projectId: "sales-management-76f5c",
  storageBucket: "sales-management-76f5c.firebasestorage.app",
  messagingSenderId: "986846547485",
  appId: "1:986846547485:web:9326580ed3822bd7bd80f4",
  measurementId: "G-YPN2L9Q9H7",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
