import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCl7wK44p4vlG2hvLXr6PLrksnB6bxnQbk",
  authDomain: "gestion-chantier-b5e11.firebaseapp.com",
  projectId: "gestion-chantier-b5e11",
  storageBucket: "gestion-chantier-b5e11.firebasestorage.app",
  messagingSenderId: "390756939710",
  appId: "1:390756939710:web:aaa7b1ec6f58d0335aabef",
  measurementId: "G-ZFGK7WP9M7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs };
